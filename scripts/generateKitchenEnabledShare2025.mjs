/**
 * Generates the habilitadas / all national kitchens snapshot, including
 * kitchens without coordinates. Run: node scripts/generateKitchenEnabledShare2025.mjs
 * Municipality names are resolved within their UF; unmatched names use geometry.
 * Embu das Artes is the declared name for the reference's historical Embu entry.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { format, resolveConfig } from 'prettier';

import {
  findMunicipio,
  indexMunicipios,
} from '../src/data-gateway/transformers/municipioIndex.ts';
import { parseCozinhasCsv } from '../src/data-source-static/readStaticCozinhas.ts';

const CSV_PATH =
  'src/data-source-static/data/cozinhas_com_geolocalizacao_2025.csv';
const GEOMETRY_PATH = 'public/geo/geojs-100-mun.json';
const NAMES_PATH = 'public/geo/municipios-nomes.json';
const UFS_PATH = 'src/data-source-static/data/caf-pontos.json';
const OUTPUT_PATH =
  'src/data-source-static/data/kitchen-enabled-share-2025.json';
const normalize = (name) => {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
};

const positionOf = (kitchen) => {
  return kitchen.latitude !== null && kitchen.longitude !== null
    ? [kitchen.longitude, kitchen.latitude]
    : null;
};

// Midpoints between vertex latitudes avoid edge/vertex degeneracies. Scanline
// intersections include hole rings, so alternating pairs are interior segments.
const scanlineIntersections = ({ rings, y }) => {
  const xs = [];
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i += 1) {
      const [a, b] = [ring[i - 1], ring[i]];
      if (a[1] > y !== b[1] > y) {
        xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    }
  }
  return xs;
};

const anchorOf = (municipio) => {
  const polygons =
    municipio.geometry.type === 'Polygon'
      ? [municipio.geometry.coordinates]
      : municipio.geometry.coordinates;
  let best = null;
  let width = -1;
  for (const rings of polygons) {
    const latitudes = [
      ...new Set(
        rings.flat(1).map((point) => {
          return point[1];
        })
      ),
    ].sort((a, b) => {
      return a - b;
    });
    for (let j = 1; j < latitudes.length; j += 1) {
      const y = (latitudes[j - 1] + latitudes[j]) / 2;
      const xs = scanlineIntersections({ rings, y });
      xs.sort((a, b) => {
        return a - b;
      });
      for (let i = 1; i < xs.length; i += 2) {
        const candidate = [(xs[i - 1] + xs[i]) / 2, y];
        const span = xs[i] - xs[i - 1];
        if (
          span > width &&
          findMunicipio({ index: [municipio], point: candidate })
        ) {
          best = candidate;
          width = span;
        }
      }
    }
  }
  if (!best) throw new Error(`No interior anchor for ${municipio.codigoIbge}`);
  return best;
};

const csv = await readFile(CSV_PATH, 'utf8');
const geometryText = await readFile(GEOMETRY_PATH, 'utf8');
const namesText = await readFile(NAMES_PATH, 'utf8');
const kitchens = parseCozinhasCsv(csv);
const names = JSON.parse(namesText);
const ufsText = await readFile(UFS_PATH, 'utf8');
const ufs = JSON.parse(ufsText).ufs;
const ufByPrefix = new Map(
  ufs.map((uf) => {
    return [uf.codigoUf, uf.uf];
  })
);
const index = indexMunicipios(JSON.parse(geometryText));
const byCode = new Map(
  index.map((m) => {
    return [m.codigoIbge, m];
  })
);
const nameIndex = new Map();
for (const [code, name] of Object.entries(names)) {
  const key = `${ufByPrefix.get(code.slice(0, 2))}:${normalize(name)}`;
  if (nameIndex.has(key))
    throw new Error(`Ambiguous municipality name: ${key}`);
  nameIndex.set(key, code);
}
const codes = new Set();
for (const kitchen of kitchens) {
  if (!kitchen.codigo || codes.has(kitchen.codigo))
    throw new Error('Missing or duplicate kitchen code');
  codes.add(kitchen.codigo);
}
const enabled = kitchens.filter((kitchen) => {
  return kitchen.situacao === 'Habilitada';
});
const counts = new Map();
const assignments = [];
const registeredCounts = new Map();
const registeredAssignments = [];
const unresolved = [];
for (const kitchen of kitchens) {
  const key = `${kitchen.uf}:${normalize(kitchen.municipio)}`;
  let code = nameIndex.get(key);
  let method = 'name-uf';
  if (!code && key === 'SP:EMBU DAS ARTES') {
    code = '3515004';
    method = 'historical-name';
  }
  const point = positionOf(kitchen);
  if (!code && point) {
    code = findMunicipio({ index, point })?.codigoIbge;
    method = 'point-in-polygon';
  }
  if (!code || !byCode.has(code)) {
    unresolved.push(kitchen.codigo);
    continue;
  }
  registeredCounts.set(code, (registeredCounts.get(code) ?? 0) + 1);
  const assignment = {
    kitchenCode: kitchen.codigo,
    municipalityCode: code,
    method,
  };
  registeredAssignments.push(assignment);
  if (kitchen.situacao === 'Habilitada') {
    counts.set(code, (counts.get(code) ?? 0) + 1);
    assignments.push(assignment);
  }
}
// Refuse a complete-looking layer when some habilitadas cannot be attributed.
if (unresolved.length)
  throw new Error(`Unresolved kitchens: ${unresolved.join(', ')}`);
const municipalities = [...counts]
  .sort(([a], [b]) => {
    return a.localeCompare(b);
  })
  .map(([code, count]) => {
    return {
      code,
      name: names[code],
      uf: ufByPrefix.get(code.slice(0, 2)),
      count,
      anchor: anchorOf(byCode.get(code)),
    };
  });
const registeredMunicipalities = [...registeredCounts]
  .sort(([a], [b]) => {
    return a.localeCompare(b);
  })
  .map(([code, total]) => {
    return {
      code,
      name: names[code],
      uf: ufByPrefix.get(code.slice(0, 2)),
      total,
      enabled: counts.get(code) ?? 0,
      anchor:
        municipalities.find((row) => {
          return row.code === code;
        })?.anchor ?? anchorOf(byCode.get(code)),
    };
  });
const snapshot = {
  year: 2025,
  nationalTotal: kitchens.length,
  nationalEnabled: enabled.length,
  unresolvedEnabled: unresolved.length,
  provenance: [CSV_PATH, GEOMETRY_PATH, NAMES_PATH, UFS_PATH].map((path, i) => {
    return {
      path,
      sha256: createHash('sha256')
        .update([csv, geometryText, namesText, ufsText][i])
        .digest('hex'),
    };
  }),
  assignments,
  registeredAssignments,
  registeredMunicipalities,
  municipalities,
};
await writeFile(
  OUTPUT_PATH,
  await format(JSON.stringify(snapshot), {
    ...(await resolveConfig(OUTPUT_PATH)),
    parser: 'json',
  })
);
process.stdout.write(
  `${municipalities.length} municipalities; ${enabled.length}/${kitchens.length}; ${unresolved.length} unresolved\n`
);
