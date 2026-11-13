import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseCsv } from './parseCsv';
import type { StaticPaaUnidadeRecebedoraSource } from './types';

const CSV_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'conab_paa_cozinhas_unidades_recebedoras_2025.csv'
);

/**
 * First cell of the real header row. The CONAB export opens with institutional
 * lines (CONAB/DIPAI/SUPAF/GEIAF) above it, so the header is located by this
 * marker rather than by position.
 */
const HEADER_MARKER = 'ANO';

/** Source column header holding the purchase proposal id. */
const PROPOSAL_COLUMN = 'Num TPAF';
/** Source column header holding the cozinha's 7-digit IBGE code (column J). */
const CODE_COLUMN = 'Cod IBGE Consumidor';
/** Source column header holding the cozinha's município name. */
const NAME_COLUMN = 'Municipio Consumidor';
/** Source column header holding the cozinha's registration code. */
const KITCHEN_COLUMN = 'Código da Cozinha';
/** Source column header holding the people served (column W). */
const PEOPLE_COLUMN = 'Qtd Total Atendidos';

/** Locates a column by exact header name; throws when it is absent. */
const columnIndex = (header: string[], name: string): number => {
  const index = header.indexOf(name);
  if (index === -1) {
    throw new Error(
      `[data-source-static] PAA unidades recebedoras CSV is missing the "${name}" column.`
    );
  }
  return index;
};

/**
 * Parses and validates the CONAB "PAA Cozinhas Solidárias — UNIDADES
 * RECEBEDORAS" export into typed records, one per (proposal, cozinha) row.
 * Pure (no I/O): the disk read lives in {@link readStaticPaaUnidadesRecebedoras}.
 *
 * The institutional lines above the header are skipped by locating the
 * {@link HEADER_MARKER} row, and rows without an IBGE code (blank lines) are
 * dropped. Columns are located by header name, so reordering survives.
 *
 * @param text - Raw CSV text (a leading UTF-8 BOM is tolerated and stripped).
 * @returns One record per receiving-unit row, in file order.
 * @throws If the header row is absent, a required column is missing, or a
 * people count is not a non-negative integer.
 *
 * @example
 * parsePaaUnidadesRecebedoras(
 *   'CONAB,,,,,\n' +
 *     'ANO,Num TPAF,Cod IBGE Consumidor,Municipio Consumidor,Qtd Total Atendidos,Código da Cozinha\n' +
 *     '2025,AC/2025/02/0208,1200401,RIO BRANCO,350,CS023192'
 * );
 * // [{ tpaf: 'AC/2025/02/0208', codigoIbge: '1200401', municipio: 'RIO BRANCO',
 * //    codigoCozinha: 'CS023192', pessoasAtendidas: 350 }]
 */
export const parsePaaUnidadesRecebedoras = (
  text: string
): StaticPaaUnidadeRecebedoraSource[] => {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = parseCsv(clean);

  const headerIndex = rows.findIndex((cells) => {
    return cells[0]?.trim() === HEADER_MARKER;
  });
  if (headerIndex === -1) {
    throw new Error(
      `[data-source-static] PAA unidades recebedoras CSV has no "${HEADER_MARKER}" header row.`
    );
  }

  const header = rows[headerIndex].map((cell) => {
    return cell.trim();
  });
  const proposalIndex = columnIndex(header, PROPOSAL_COLUMN);
  const codeIndex = columnIndex(header, CODE_COLUMN);
  const nameIndex = columnIndex(header, NAME_COLUMN);
  const kitchenIndex = columnIndex(header, KITCHEN_COLUMN);
  const peopleIndex = columnIndex(header, PEOPLE_COLUMN);

  return rows
    .slice(headerIndex + 1)
    .filter((cells) => {
      return (cells[codeIndex] ?? '').trim() !== '';
    })
    .map((cells) => {
      const at = (index: number): string => {
        return (cells[index] ?? '').trim();
      };
      const codigoIbge = at(codeIndex);
      // pt-BR thousands separator (`1.250`); the counts are whole people.
      const rawPeople = at(peopleIndex);
      const pessoasAtendidas = Number(rawPeople.replaceAll('.', ''));
      if (
        rawPeople === '' ||
        !Number.isInteger(pessoasAtendidas) ||
        pessoasAtendidas < 0
      ) {
        throw new Error(
          `[data-source-static] município ${codigoIbge} has an invalid ${PEOPLE_COLUMN}: "${rawPeople}".`
        );
      }

      return {
        tpaf: at(proposalIndex),
        codigoIbge,
        municipio: at(nameIndex),
        codigoCozinha: at(kitchenIndex),
        pessoasAtendidas,
      };
    });
};

let cache: StaticPaaUnidadeRecebedoraSource[] | null = null;

/**
 * Reads, parses and validates the static CONAB export of the cozinhas that
 * receive the 2025 PAA purchases, with the people each one serves per proposal.
 *
 * Server-only: it reads the CSV from disk with `fs`, so it must be called from a
 * Server Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process.
 *
 * @returns The receiving-unit rows from
 * `data/conab_paa_cozinhas_unidades_recebedoras_2025.csv`.
 * @throws If the CSV is malformed (see {@link parsePaaUnidadesRecebedoras}).
 *
 * @example
 * const unidades = await readStaticPaaUnidadesRecebedoras();
 * unidades.filter((u) => u.tpaf === 'AC/2025/02/0210'); // that proposal's cozinhas
 */
export const readStaticPaaUnidadesRecebedoras = async (): Promise<
  StaticPaaUnidadeRecebedoraSource[]
> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(CSV_PATH, 'utf8');
  cache = parsePaaUnidadesRecebedoras(raw);

  return cache;
};
