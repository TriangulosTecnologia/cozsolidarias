import {
  ABSOLUTE_TOTAL_DATASET_IDS,
  RENDERABLE_DATASET_FETCHERS,
  RENDERABLE_DATASET_IDS,
} from 'src/app/api/ai/spec/mapDataCatalogue';
import {
  CATALOG_VARIANTS,
  familyOf,
  FILTERABLE_BASES,
  RENDERABLE_FIELD_IDS,
  RENDERABLE_FIELD_META,
} from 'src/app/api/ai/spec/renderableFields';
import {
  COZINHAS_YEARS,
  LATEST_COZINHA_YEAR,
} from 'src/data-source-static/readStaticCozinhas';

describe('renderable-field registry parity', () => {
  test('every registry id has a fetcher, and every fetcher has a registry entry', () => {
    expect([...Object.keys(RENDERABLE_DATASET_FETCHERS)].sort()).toEqual(
      [...RENDERABLE_FIELD_IDS].sort()
    );
    expect([...RENDERABLE_DATASET_IDS].sort()).toEqual(
      [...RENDERABLE_FIELD_IDS].sort()
    );
  });

  test('the catalogue variants are exactly the registry entries that declare one', () => {
    const declared = RENDERABLE_FIELD_IDS.filter((id) => {
      return RENDERABLE_FIELD_META[id].catalog !== undefined;
    }).sort();

    expect(Object.keys(CATALOG_VARIANTS).sort()).toEqual(declared);
  });

  test('the absolute-total list comes from the registry flag', () => {
    expect([...ABSOLUTE_TOTAL_DATASET_IDS]).toEqual([
      'cozinhas_pessoas_atendidas',
    ]);
  });

  test('familyOf reads the family a registry id belongs to, and nothing for an unknown id', () => {
    expect(familyOf('municipios_ivs_infraestrutura')).toBe('ivs');
    expect(familyOf('cozinhas_geolocalizadas_2025')).toBe('cozinhas');
    expect(familyOf('caf_areas')).toBeUndefined();
  });

  test('filterable bases count snapshot years the data source has, the default one the latest', () => {
    for (const { ano } of FILTERABLE_BASES) {
      expect(COZINHAS_YEARS).toContain(ano);
    }
    expect(
      FILTERABLE_BASES.find(({ baseId }) => {
        return baseId === 'cozinhas_geolocalizadas';
      })?.ano
    ).toBe(LATEST_COZINHA_YEAR);
  });
});
