/**
 * Offline generator for the per-município CAF snapshot consumed by the
 * "% dos CAFs do Brasil no município" choropleth.
 *
 * The raw `caf-area.csv` snapshot has ~4.2M rows (~426 MB): reading it whole at
 * request time materializes millions of objects and blows the Node heap, so the
 * app must NEVER parse it in runtime. Instead this script streams the CSV line
 * by line (constant CSV buffer, no full-file array) and writes a tiny aggregate
 * (~5.5k rows) that the gateway can read cheaply — the same pattern the other
 * heavy static datasets use (municipios-nomes.json, assentamentos-atributos.json).
 *
 * Aggregation semantics: one CAF is a distinct `nr_caf`. Only rows flagged as
 * the CAF's principal property (`st_imovel_principal = true`) are counted — the
 * secondary-area rows are ignored so a CAF maps to its main location, not to
 * every parcel it holds. A município's count is the number of distinct `nr_caf`
 * whose principal-area rows fall inside it; a CAF spanning more than one
 * município is counted once in each (so the counts sum to a national total
 * slightly above the distinct-CAF count). The dedup is done with a per-município
 * `Set<nr_caf>` — robust regardless of row ordering.
 *
 * Run it with a raised heap (the dedup Sets hold ~3.95M keys):
 *
 *   node --max-old-space-size=4096 scripts/generateCafPorMunicipio.ts
 *
 * Output: src/data-source-static/data/caf-por-municipio.json
 */
import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const INPUT_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-area.csv'
);

const OUTPUT_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-por-municipio.json'
);

/** Column order in `caf-area.csv`, used to validate the header. */
const EXPECTED_HEADER = [
  'nr_caf',
  'ds_tipo_area',
  'ds_tipo_unidade_medida',
  'nr_area',
  'cd_municipio',
  'sg_uf',
  'nm_municipio',
  'ds_tipo_localizacao_area',
  'ds_condicao_dominio',
  'st_imovel_principal',
  'nr_latitude',
  'nr_longitude',
];

const NR_CAF_INDEX = 0;
const CD_MUNICIPIO_INDEX = 4;
const NM_MUNICIPIO_INDEX = 6;
const ST_IMOVEL_PRINCIPAL_INDEX = 9;

/**
 * Splits one semicolon-delimited CSV line into cells, honoring double-quoted
 * fields (which may contain semicolons) and escaped `""`. The CAF fields we read
 * (`nr_caf`, `cd_municipio`, `nm_municipio`) never contain embedded newlines, so
 * a per-line split is sufficient — no cross-line quote state is threaded.
 */
const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = false;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ';') {
      cells.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  cells.push(field);
  return cells;
};

type Bucket = { nmMunicipio: string; cafs: Set<string> };

/**
 * Folds one data row into the per-município buckets: skips non-principal rows
 * (`st_imovel_principal !== 'true'`) and rows missing the CAF id or município,
 * then records the distinct `nr_caf` under the município's `Set`.
 */
const aggregateRow = (cells: string[], buckets: Map<string, Bucket>): void => {
  const stImovelPrincipal = (cells[ST_IMOVEL_PRINCIPAL_INDEX] ?? '').trim();
  // Count only the CAF's principal property; skip secondary-area rows so a CAF
  // maps to its main location instead of every parcel it holds.
  if (stImovelPrincipal !== 'true') {
    return;
  }

  const nrCaf = (cells[NR_CAF_INDEX] ?? '').trim();
  const cdMunicipio = (cells[CD_MUNICIPIO_INDEX] ?? '').trim();
  if (nrCaf === '' || cdMunicipio === '') {
    return;
  }

  const nmMunicipio = (cells[NM_MUNICIPIO_INDEX] ?? '').trim();
  let bucket = buckets.get(cdMunicipio);
  if (!bucket) {
    bucket = { nmMunicipio, cafs: new Set() };
    buckets.set(cdMunicipio, bucket);
  }
  bucket.cafs.add(nrCaf);
};

const main = async (): Promise<void> => {
  const stream = createReadStream(INPUT_PATH, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });

  const buckets = new Map<string, Bucket>();
  let isHeader = true;
  let rows = 0;

  for await (const rawLine of lines) {
    // A trailing empty line (or a spurious blank) carries no record.
    if (rawLine.trim() === '') {
      continue;
    }

    const cells = splitCsvLine(rawLine);

    if (isHeader) {
      isHeader = false;
      const mismatch = EXPECTED_HEADER.findIndex((name, index) => {
        return cells[index]?.trim() !== name;
      });
      if (mismatch !== -1) {
        throw new Error(
          `[generateCafPorMunicipio] header mismatch at column ${mismatch}: ` +
            `expected "${EXPECTED_HEADER[mismatch]}", found "${cells[mismatch]}".`
        );
      }
      continue;
    }

    rows += 1;
    aggregateRow(cells, buckets);
  }

  const records = [...buckets]
    .map(([cdMunicipio, { nmMunicipio, cafs }]) => {
      return { cdMunicipio, nmMunicipio, quantidade: cafs.size };
    })
    .sort((a, b) => {
      return b.quantidade - a.quantidade;
    });

  await writeFile(OUTPUT_PATH, `${JSON.stringify(records, null, 2)}\n`, 'utf8');

  const total = records.reduce((sum, r) => {
    return sum + r.quantidade;
  }, 0);
  const shares = records
    .map((r) => {
      return (r.quantidade / total) * 100;
    })
    .sort((a, b) => {
      return a - b;
    });
  const percentile = (p: number): number => {
    return shares[
      Math.min(shares.length - 1, Math.floor((p / 100) * shares.length))
    ];
  };

  process.stderr.write(
    [
      `[generateCafPorMunicipio] parsed ${rows} rows`,
      `municípios: ${records.length}`,
      `distinct CAF-in-município pairs (sum): ${total}`,
      `share % — p50=${percentile(50).toFixed(4)} p75=${percentile(75).toFixed(4)} ` +
        `p90=${percentile(90).toFixed(4)} p99=${percentile(99).toFixed(4)} ` +
        `max=${shares[shares.length - 1].toFixed(4)}`,
      `wrote ${OUTPUT_PATH}`,
    ].join('\n') + '\n'
  );
};

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
