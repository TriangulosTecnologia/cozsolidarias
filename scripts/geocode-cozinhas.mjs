/**
 * Re-geocodes every cozinha in the static CSV using the Google Geocoding API,
 * overwriting existing coordinates and filling in the missing ones so all
 * kitchens can be plotted on the map.
 *
 * Safe by design:
 *  - backs up the CSV before writing (<csv>.pre-geocode.bak);
 *  - caches every API response on disk (scripts/.geocode-cache.json) so a
 *    re-run or a crash never re-spends quota;
 *  - only overwrites a coordinate when geocoding returns OK — a failed lookup
 *    keeps whatever was already there (never blanks a good value);
 *  - runs a round-trip self-check (re-parses its own output and asserts every
 *    non-coordinate cell is byte-identical to the input) and aborts on any
 *    mismatch, leaving the original file untouched;
 *  - writes an audit report (scripts/geocode-report.csv) with precision
 *    (location_type) and the old→new distance in km for review.
 *
 * Usage:  GOOGLE_MAPS_API_KEY=... node scripts/geocode-cozinhas.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers';
import { URLSearchParams } from 'node:url';

const CSV =
  process.env.GEOCODE_CSV ??
  'src/data-source-static/data/cozinhas_com_geolocalizacao_all.csv';
const CACHE = process.env.GEOCODE_CACHE ?? 'scripts/.geocode-cache.json';
const REPORT = process.env.GEOCODE_REPORT ?? 'scripts/geocode-report.csv';
const CONCURRENCY = 10;

const KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY environment variable.');
  process.exit(1);
}

const sleep = (ms) => {
  return new Promise((r) => {
    return setTimeout(r, ms);
  });
};
const isBlank = (v) => {
  const t = (v ?? '').trim();
  return t === '' || t === '---';
};

/** RFC 4180 parser — mirrors readStaticCozinhas.ts so read/write round-trips. */
const parseCsv = (text) => {
  const st = { rows: [], row: [], field: '', inQuotes: false };
  // One char inside a quoted field. Returns extra chars consumed: 1 when an
  // escaped "" pair collapses to a single ", otherwise 0.
  const inQuoted = (c, n) => {
    if (c !== '"') {
      st.field += c;
      return 0;
    }
    if (n === '"') {
      st.field += '"';
      return 1;
    }
    st.inQuotes = false;
    return 0;
  };
  // One char outside quotes: quote-open, delimiter, row break, or literal.
  const unquoted = (c) => {
    if (c === '"') st.inQuotes = true;
    else if (c === ',') {
      st.row.push(st.field);
      st.field = '';
    } else if (c === '\n') {
      st.row.push(st.field);
      st.rows.push(st.row);
      st.row = [];
      st.field = '';
    } else if (c !== '\r') st.field += c;
  };
  for (let i = 0; i < text.length; i += 1) {
    if (st.inQuotes) i += inQuoted(text[i], text[i + 1]);
    else unquoted(text[i]);
  }
  if (st.field !== '' || st.row.length > 0) {
    st.row.push(st.field);
    st.rows.push(st.row);
  }
  return st.rows;
};

/** Minimal RFC 4180 field escaper accepted by the project's parser. */
const escapeField = (v) => {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
const toCsv = (rows) => {
  return `${rows
    .map((r) => {
      return r.map(escapeField).join(',');
    })
    .join('\n')}\n`;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRad = (x) => {
    return (x * Math.PI) / 180;
  };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const geocode = async (query) => {
  const url =
    'https://maps.googleapis.com/maps/api/geocode/json?' +
    new URLSearchParams({
      address: query,
      key: KEY,
      region: 'br',
      components: 'country:BR',
    });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, {
        signal: globalThis.AbortSignal.timeout(15000),
      });
      const d = await res.json();
      if (d.status === 'OK') {
        const g = d.results[0].geometry;
        return {
          status: 'OK',
          lat: g.location.lat,
          lng: g.location.lng,
          location_type: g.location_type,
          formatted: d.results[0].formatted_address,
        };
      }
      if (d.status === 'ZERO_RESULTS') return { status: 'ZERO_RESULTS' };
      if (d.status === 'OVER_QUERY_LIMIT' || d.status === 'UNKNOWN_ERROR') {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      return { status: d.status, error: d.error_message };
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  return { status: 'RETRY_EXHAUSTED' };
};

const raw = await readFile(CSV, 'utf8');
const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
const rows = parseCsv(clean);
const header = rows[0];
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`column not found: ${name}`);
  return i;
};
const iAddr = col('Endereço da Cozinha');
const iBairro = col('Bairro da Cozinha');
const iCep = col('CEP');
const iMun = col('Município da Cozinha');
const iUf = col('UF');
const iCod = col('Código da Cozinha');
const iNome = col('Nome da Cozinha');
const iLat = col('Latitude');
const iLng = col('Longitude');

const data = rows.slice(1).filter((r) => {
  return r.some((c) => {
    return c.trim() !== '';
  });
});

const buildQuery = (r) => {
  return (
    [r[iAddr], r[iBairro], r[iMun], r[iUf], r[iCep]]
      .map((x) => {
        return (x ?? '').trim();
      })
      .filter((x) => {
        return x && x !== '---';
      })
      .join(', ') + ', Brasil'
  );
};

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
let cacheDirty = 0;
const saveCache = () => {
  return writeFileSync(CACHE, JSON.stringify(cache));
};

const queries = [...new Set(data.map(buildQuery))];
const todo = queries.filter((q) => {
  return !(q in cache);
});
console.log(
  `records=${data.length} uniqueQueries=${queries.length} cached=${queries.length - todo.length} toFetch=${todo.length}`
);

let done = 0;
const iterator = todo[Symbol.iterator]();
const worker = async () => {
  for (const q of iterator) {
    cache[q] = await geocode(q);
    done += 1;
    cacheDirty += 1;
    if (cacheDirty >= 25) {
      saveCache();
      cacheDirty = 0;
    }
    if (done % 100 === 0) console.log(`  geocoded ${done}/${todo.length}`);
  }
};
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
saveCache();

let updated = 0;
let filled = 0;
let failedKept = 0;
let stillMissing = 0;
const precision = {};
const outRows = [header.slice()];
const report = [
  [
    'codigo',
    'nome',
    'query',
    'old_lat',
    'old_lng',
    'new_lat',
    'new_lng',
    'status',
    'location_type',
    'delta_km',
    'formatted',
  ],
];

for (const r of data) {
  const q = buildQuery(r);
  const g = cache[q] ?? { status: 'MISSING_FROM_CACHE' };
  const oldLat = r[iLat];
  const oldLng = r[iLng];
  const hadCoord = !(isBlank(oldLat) || isBlank(oldLng));
  const nr = r.slice();
  let deltaKm = '';

  if (g.status === 'OK') {
    nr[iLat] = g.lat.toFixed(7);
    nr[iLng] = g.lng.toFixed(7);
    precision[g.location_type] = (precision[g.location_type] ?? 0) + 1;
    if (hadCoord) {
      updated += 1;
      deltaKm = haversineKm(
        Number(oldLat),
        Number(oldLng),
        g.lat,
        g.lng
      ).toFixed(3);
    } else {
      filled += 1;
    }
  } else if (hadCoord) {
    failedKept += 1;
  } else {
    stillMissing += 1;
  }

  outRows.push(nr);
  report.push([
    r[iCod],
    r[iNome],
    q,
    oldLat,
    oldLng,
    nr[iLat],
    nr[iLng],
    g.status,
    g.location_type ?? '',
    deltaKm,
    g.formatted ?? '',
  ]);
}

// Round-trip self-check: re-parse our output and assert every non-coordinate
// cell is identical to the input. Abort (leaving the CSV untouched) on any drift.
const rebuilt = toCsv(outRows);
const check = parseCsv(rebuilt)
  .slice(1)
  .filter((r) => {
    return r.some((c) => {
      return c.trim() !== '';
    });
  });
if (check.length !== data.length) {
  throw new Error(
    `self-check failed: row count ${check.length} !== ${data.length}`
  );
}
for (let i = 0; i < data.length; i += 1) {
  for (let j = 0; j < header.length; j += 1) {
    if (j === iLat || j === iLng) continue;
    if ((data[i][j] ?? '') !== (check[i][j] ?? '')) {
      throw new Error(
        `self-check failed at row ${i} col ${j} ("${header[j]}"): "${data[i][j]}" !== "${check[i][j]}"`
      );
    }
  }
}

await copyFile(CSV, `${CSV}.pre-geocode.bak`);
await writeFile(CSV, rebuilt);
await writeFile(REPORT, toCsv(report));

console.log('\n--- done ---');
console.log(`updated (had coord, replaced): ${updated}`);
console.log(`filled  (was missing):         ${filled}`);
console.log(`failed, kept existing coord:   ${failedKept}`);
console.log(`still missing (unfillable):    ${stillMissing}`);
console.log('precision (location_type):', precision);
console.log(`backup:  ${CSV}.pre-geocode.bak`);
console.log(`report:  ${REPORT}`);
