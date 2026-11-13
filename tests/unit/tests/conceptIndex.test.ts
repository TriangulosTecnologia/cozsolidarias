import {
  buildConceptIndex,
  classifyConcepts,
  coversYear,
  KNOWN_ABSENT_WORDS,
  loadConceptIndex,
} from 'src/app/api/ai/spec/conceptIndex';

import type { CatalogueContract } from '@/data-gateway/schema';
import { gateway } from '@/gateway';

const loadIndex = async () => {
  return buildConceptIndex(await gateway.getCatalogue());
};

describe('buildConceptIndex', () => {
  test('marks a dataset renderable when the route can paint it or one of its variants', async () => {
    const index = await loadIndex();
    const byId = Object.fromEntries(
      index.map((entry) => {
        return [entry.datasetId, entry];
      })
    );

    expect(byId['municipios_ivs']?.renderable).toBe(true);
    expect(byId['municipios_ivs']?.ids).toEqual(
      expect.arrayContaining([
        'municipios_ivs',
        'municipios_ivs_infraestrutura',
        'municipios_idhm_renda',
      ])
    );
    expect(byId['cozinhas_geolocalizadas']?.renderable).toBe(true);
    expect(byId['assentamentos']?.renderable).toBe(false);
    expect(byId['assentamentos']?.ids).toEqual([]);
  });

  test('derives the years a dataset covers from its temporal extent, none when undocumented', async () => {
    const index = await loadIndex();
    const byId = Object.fromEntries(
      index.map((entry) => {
        return [entry.datasetId, entry];
      })
    );

    expect(byId['municipios_ivs']?.years).toEqual([[2010, 2010]]);
    expect(byId['municipios_contorno']?.years).toEqual([]);
  });

  test('keeps an open-ended extent open, with a missing start or end', () => {
    const catalogue = {
      datasets: [
        {
          id: 'municipios_cadinsan',
          title: 'Insegurança',
          description: 'famílias',
          fields: [],
          temporal: {
            status: 'described',
            extent: [
              { start: '2020-01-01', end: null },
              { start: null, end: '2019-12-31' },
            ],
          },
        },
      ],
    } as unknown as CatalogueContract;

    expect(buildConceptIndex(catalogue)[0]?.years).toEqual([
      [2020, Infinity],
      [-Infinity, 2019],
    ]);
  });
});

describe('coversYear', () => {
  test('is true when any dataset holding the id covers the year', async () => {
    const index = await loadIndex();

    expect(coversYear({ index, id: 'municipios_ivs', year: 2010 })).toBe(true);
    expect(coversYear({ index, id: 'municipios_ivs', year: 2022 })).toBe(false);
    expect(
      coversYear({ index, id: 'cozinhas_geolocalizadas_2025', year: 2025 })
    ).toBe(true);
  });

  test('a dataset with no documented extent covers any year', () => {
    const catalogue = {
      datasets: [
        {
          id: 'municipios_cadinsan',
          title: 'Insegurança',
          description: 'famílias',
          fields: [],
          temporal: { status: 'unknown' },
        },
      ],
    } as unknown as CatalogueContract;

    expect(
      coversYear({
        index: buildConceptIndex(catalogue),
        id: 'municipios_cadinsan',
        year: 1900,
      })
    ).toBe(true);
  });

  test('treats an id no dataset documents as covering any year', async () => {
    const index = await loadIndex();

    expect(coversYear({ index, id: 'unknown_id', year: 1900 })).toBe(true);
  });
});

describe('classifyConcepts', () => {
  test('covered: a concept the renderable datasets describe', async () => {
    const index = await loadIndex();

    expect(
      classifyConcepts({ text: 'mapa de vulnerabilidade social', index })
    ).toEqual({ status: 'covered' });
  });

  test('notRenderable: a concept only a catalogued, unserved dataset describes', async () => {
    const index = await loadIndex();

    expect(
      classifyConcepts({ text: 'mapa dos assentamentos rurais', index })
    ).toMatchObject({
      status: 'notRenderable',
      titles: expect.arrayContaining(['Assentamentos rurais (SICAR)']),
    });
  });

  test('absent: no catalogue dataset describes any content word', async () => {
    const index = await loadIndex();

    expect(
      classifyConcepts({ text: 'mapa de rodovias e aeroportos', index })
    ).toEqual({ status: 'absent', terms: ['rodovias', 'aeroportos'] });
  });

  test('unknown: a word the catalogue neither describes nor is known to lack goes to the agent', async () => {
    const index = await loadIndex();

    expect(
      classifyConcepts({ text: 'mapa de coisas qualquer', index })
    ).toEqual({ status: 'unknown' });
  });

  test('every word the absent lexicon lists is still missing from the catalogue', async () => {
    const index = await loadIndex();

    for (const word of KNOWN_ABSENT_WORDS) {
      expect(classifyConcepts({ text: word, index })).toEqual({
        status: 'absent',
        terms: [word],
      });
    }
  });

  test('a single unknown word beside a known concept stays covered', async () => {
    const index = await loadIndex();

    expect(
      classifyConcepts({
        text: 'ivs com bolinhas coloridas',
        index,
      })
    ).toEqual({ status: 'covered' });
  });

  test("unknown: a boundary-only dataset is no concept, a base map is the agent's to draw", async () => {
    const index = await loadIndex();

    expect(
      classifyConcepts({ text: 'mapa de estados do brasil', index })
    ).toEqual({ status: 'unknown' });
    expect(
      index.find((entry) => {
        return entry.datasetId === 'estados_contorno';
      })?.stems.size
    ).toBe(0);
  });

  test('unknown: a prompt with no content word says nothing', async () => {
    const index = await loadIndex();

    expect(classifyConcepts({ text: 'quero ver um mapa', index })).toEqual({
      status: 'unknown',
    });
  });

  test('unknown: an empty index never blocks', () => {
    expect(classifyConcepts({ text: 'mapa de rodovias', index: [] })).toEqual({
      status: 'unknown',
    });
  });
});

describe('loadConceptIndex', () => {
  test('indexes the catalogue the loader returns', async () => {
    const index = await loadConceptIndex(() => {
      return gateway.getCatalogue();
    });

    expect(index.length).toBeGreaterThan(0);
  });

  test('an unreadable catalogue yields an empty index, so the preflight never blocks', async () => {
    const index = await loadConceptIndex(() => {
      return Promise.reject(new Error('catalogue unreadable'));
    });

    expect(index).toEqual([]);
  });
});
