import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseCsv } from './parseCsv';
import type { StaticPaaProdutoSource } from './types';

const CSV_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'conab_paa_cozinhas_produtos_2025.csv'
);

/**
 * First cell of the real header row. The CONAB export opens with institutional
 * lines (CONAB/DIPAI/SUPAF, "ESTADOS:", "PERÍODO:") above it, so the header is
 * located by this marker rather than by position.
 */
const HEADER_MARKER = 'ANO ORÇAMENTO';

/** Source column header holding the purchase proposal id. */
const PROPOSAL_COLUMN = 'TPAF';
/** Source column header holding the 7-digit IBGE code (column H). */
const CODE_COLUMN = 'IBGE';
/** Source column header holding the município name. */
const NAME_COLUMN = 'MUNICÍPIO';
/** Source column header holding the supplier's CNPJ. */
const CNPJ_COLUMN = 'CNPJ PROPONENTE';
/** Source column header holding the product name. */
const PRODUCT_COLUMN = 'PRODUTO';
/** Source column header holding the planned quantity in kg (column R). */
const QUANTITY_COLUMN = 'QUANTIDADE (KG)';

/** Locates a column by exact header name; throws when it is absent. */
const columnIndex = (header: string[], name: string): number => {
  const index = header.indexOf(name);
  if (index === -1) {
    throw new Error(
      `[data-source-static] PAA produtos CSV is missing the "${name}" column.`
    );
  }
  return index;
};

/**
 * Parses a pt-BR formatted quantity (`1.250` = 1250, `12,5` = 12.5) into a
 * number, or `NaN` when it is not one.
 */
const parsePtBrNumber = (raw: string): number => {
  return Number(raw.replaceAll('.', '').replace(',', '.'));
};

/**
 * Parses and validates the CONAB "PAA Cozinhas Solidárias — PRODUTOS" export
 * into typed records, one per (proposal, product) row. Pure (no I/O): the disk
 * read lives in {@link readStaticPaaProdutos}.
 *
 * The institutional lines above the header are skipped by locating the
 * {@link HEADER_MARKER} row, and the trailing grand-total row (no IBGE code) is
 * dropped. Columns are located by header name, so reordering survives.
 *
 * @param text - Raw CSV text (a leading UTF-8 BOM is tolerated and stripped).
 * @returns One record per product row, in file order.
 * @throws If the header row is absent, a required column is missing, or a
 * quantity cell is not a finite pt-BR number.
 *
 * @example
 * parsePaaProdutos(
 *   'CONAB,,,\n' +
 *     'ANO ORÇAMENTO,TPAF,IBGE,MUNICÍPIO,CNPJ PROPONENTE,PRODUTO,QUANTIDADE (KG)\n' +
 *     '2025,AC/2025/02/0208,1200104,BRASILÉIA,09.197.432/0001-09,FEIJAO,1.250\n' +
 *     ',,,,,,'
 * );
 * // [{ tpaf: 'AC/2025/02/0208', codigoIbge: '1200104', municipio: 'BRASILÉIA',
 * //    cnpjProponente: '09.197.432/0001-09', produto: 'FEIJAO', quantidadeKg: 1250 }]
 */
export const parsePaaProdutos = (text: string): StaticPaaProdutoSource[] => {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = parseCsv(clean);

  const headerIndex = rows.findIndex((cells) => {
    return cells[0]?.trim() === HEADER_MARKER;
  });
  if (headerIndex === -1) {
    throw new Error(
      `[data-source-static] PAA produtos CSV has no "${HEADER_MARKER}" header row.`
    );
  }

  const header = rows[headerIndex].map((cell) => {
    return cell.trim();
  });
  const proposalIndex = columnIndex(header, PROPOSAL_COLUMN);
  const codeIndex = columnIndex(header, CODE_COLUMN);
  const nameIndex = columnIndex(header, NAME_COLUMN);
  const cnpjIndex = columnIndex(header, CNPJ_COLUMN);
  const productIndex = columnIndex(header, PRODUCT_COLUMN);
  const quantityIndex = columnIndex(header, QUANTITY_COLUMN);

  return rows
    .slice(headerIndex + 1)
    .filter((cells) => {
      // The grand-total footer (and blank lines) carry no IBGE code.
      return (cells[codeIndex] ?? '').trim() !== '';
    })
    .map((cells) => {
      const at = (index: number): string => {
        return (cells[index] ?? '').trim();
      };
      const codigoIbge = at(codeIndex);
      const rawQuantity = at(quantityIndex);
      const quantidadeKg = parsePtBrNumber(rawQuantity);
      if (rawQuantity === '' || !Number.isFinite(quantidadeKg)) {
        throw new Error(
          `[data-source-static] município ${codigoIbge} has a non-numeric ${QUANTITY_COLUMN}: "${rawQuantity}".`
        );
      }

      return {
        tpaf: at(proposalIndex),
        codigoIbge,
        municipio: at(nameIndex),
        cnpjProponente: at(cnpjIndex),
        produto: at(productIndex),
        quantidadeKg,
      };
    });
};

let cache: StaticPaaProdutoSource[] | null = null;

/**
 * Reads, parses and validates the static CONAB export of the 2025 PAA purchases
 * for the Cozinhas Solidárias (one row per product of each proposal).
 *
 * Server-only: it reads the CSV from disk with `fs`, so it must be called from a
 * Server Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process.
 *
 * @returns The product rows from `data/conab_paa_cozinhas_produtos_2025.csv`.
 * @throws If the CSV is malformed (see {@link parsePaaProdutos}).
 *
 * @example
 * const produtos = await readStaticPaaProdutos();
 * produtos.filter((p) => p.codigoIbge === '1200104'); // Brasiléia's products
 */
export const readStaticPaaProdutos = async (): Promise<
  StaticPaaProdutoSource[]
> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(CSV_PATH, 'utf8');
  cache = parsePaaProdutos(raw);

  return cache;
};
