import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { readStaticEnrichment } from 'src/data-source-static/readStaticEnrichment';

const DIR = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'enrichment'
);
const ID = 'CS999003';
const FILE = join(DIR, `${ID}.json`);

describe('readStaticEnrichment', () => {
  beforeAll(async () => {
    await mkdir(DIR, { recursive: true });
    await writeFile(
      FILE,
      JSON.stringify({ cozinhaId: ID, supplyNetwork: { municipio: 'Teste' } }),
      'utf8'
    );
  });

  afterAll(async () => {
    await rm(FILE, { force: true });
  });

  test('reads and parses an existing snapshot', async () => {
    const raw = await readStaticEnrichment({ cozinhaId: ID });

    expect(raw.cozinhaId).toBe(ID);
    expect(raw.supplyNetwork.municipio).toBe('Teste');
  });

  test('throws a clear error when the snapshot is missing', async () => {
    await expect(
      readStaticEnrichment({ cozinhaId: 'CS000404' })
    ).rejects.toThrow(/not found/);
  });
});
