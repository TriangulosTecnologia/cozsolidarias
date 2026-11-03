import {
  SITUACAO_ANO_MAIS_RECENTE,
  SITUACAO_ANOS,
  situacaoGroupsIn,
  situacaoMapDataId,
  situacaoMapDataRows,
} from 'src/app/api/ai/spec/cozinhasSituacao';
import { buildCatalogueContext } from 'src/app/api/ai/spec/mapDataCatalogue';
import { SITUACAO_FETCHERS } from 'src/app/api/ai/spec/situacaoFetchers';
import type { CozinhasSituacaoPorMunicipio } from 'src/data-gateway/schema';
import {
  COZINHAS_YEARS,
  LATEST_COZINHA_YEAR,
} from 'src/data-source-static/readStaticCozinhas';

import { gateway } from '@/gateway';

const FULL_COVERAGE: CozinhasSituacaoPorMunicipio = {
  situacoesCobertas: null,
  porMunicipio: [
    {
      codigoIbge: '111',
      municipio: 'Alpha',
      quantidadePorSituacao: {
        Habilitada: 3,
        'Não Habilitada': 2,
        Mapeada: 4,
      },
    },
    {
      codigoIbge: '222',
      municipio: 'Beta',
      quantidadePorSituacao: { Habilitada: 1 },
    },
  ],
};

const HABILITADA_ONLY: CozinhasSituacaoPorMunicipio = {
  situacoesCobertas: ['Habilitada'],
  porMunicipio: [
    {
      codigoIbge: '111',
      municipio: 'Alpha',
      quantidadePorSituacao: { Habilitada: 5 },
    },
  ],
};

describe('situacaoMapDataRows', () => {
  test('counts habilitadas per município, zero where a município has none', () => {
    expect(
      situacaoMapDataRows({ snapshot: FULL_COVERAGE, grupo: 'habilitadas' })
    ).toEqual([
      { geometryId: '111', value: 3 },
      { geometryId: '222', value: 1 },
    ]);
  });

  test('counts não habilitadas per município when the snapshot covers them', () => {
    expect(
      situacaoMapDataRows({ snapshot: FULL_COVERAGE, grupo: 'nao_habilitadas' })
    ).toEqual([
      { geometryId: '111', value: 2 },
      { geometryId: '222', value: 0 },
    ]);
  });

  test('counts a município holding only other situations as zero habilitadas and não habilitadas', () => {
    const snapshot: CozinhasSituacaoPorMunicipio = {
      situacoesCobertas: null,
      porMunicipio: [
        {
          codigoIbge: '333',
          municipio: 'Gamma',
          quantidadePorSituacao: { Mapeada: 2 },
        },
      ],
    };
    expect(situacaoMapDataRows({ snapshot, grupo: 'habilitadas' })).toEqual([
      { geometryId: '333', value: 0 },
    ]);
    expect(situacaoMapDataRows({ snapshot, grupo: 'nao_habilitadas' })).toEqual(
      [{ geometryId: '333', value: 0 }]
    );
    expect(situacaoMapDataRows({ snapshot, grupo: 'outras' })).toEqual([
      { geometryId: '333', value: 2 },
    ]);
  });

  test('counts outras as total minus habilitadas and não habilitadas', () => {
    expect(
      situacaoMapDataRows({ snapshot: FULL_COVERAGE, grupo: 'outras' })
    ).toEqual([
      { geometryId: '111', value: 4 },
      { geometryId: '222', value: 0 },
    ]);
  });

  test('refuses não habilitadas and outras when the snapshot holds only Habilitada', () => {
    expect(
      situacaoMapDataRows({
        snapshot: HABILITADA_ONLY,
        grupo: 'nao_habilitadas',
      })
    ).toBeNull();
    expect(
      situacaoMapDataRows({ snapshot: HABILITADA_ONLY, grupo: 'outras' })
    ).toBeNull();
  });

  test('answers habilitadas from the Habilitada-only snapshot', () => {
    expect(
      situacaoMapDataRows({ snapshot: HABILITADA_ONLY, grupo: 'habilitadas' })
    ).toEqual([{ geometryId: '111', value: 5 }]);
  });

  test('refuses não habilitadas when the covered list omits it, even if it names others', () => {
    const snapshot: CozinhasSituacaoPorMunicipio = {
      situacoesCobertas: ['Habilitada', 'Mapeada'],
      porMunicipio: [],
    };
    expect(
      situacaoMapDataRows({ snapshot, grupo: 'nao_habilitadas' })
    ).toBeNull();
    expect(situacaoMapDataRows({ snapshot, grupo: 'habilitadas' })).toEqual([]);
  });
});

describe('situacaoGroupsIn', () => {
  test('reads each situation a prompt names, without counting a negated one as habilitada', () => {
    expect(situacaoGroupsIn('cozinhas nao habilitadas')).toEqual([
      'nao_habilitadas',
    ]);
    expect(situacaoGroupsIn('cozinhas habilitadas')).toEqual(['habilitadas']);
    expect(situacaoGroupsIn('cozinhas outras situacoes')).toEqual(['outras']);
    expect(situacaoGroupsIn('cozinhas')).toEqual([]);
  });

  test('reports every situation a combined prompt names', () => {
    expect(situacaoGroupsIn('cozinhas habilitadas e nao habilitadas')).toEqual([
      'nao_habilitadas',
      'habilitadas',
    ]);
  });
});

describe('catalogue parity', () => {
  test('every situação fetcher id appears in the catalogue sent to the agent', async () => {
    const text = buildCatalogueContext(await gateway.getCatalogue());

    for (const id of Object.keys(SITUACAO_FETCHERS)) {
      expect(text).toContain(`"id":"${id}"`);
    }
  });
});

describe('snapshot years', () => {
  test('mirror the years and the latest year of the data source', () => {
    expect(SITUACAO_ANOS).toEqual(COZINHAS_YEARS);
    expect(SITUACAO_ANO_MAIS_RECENTE).toBe(LATEST_COZINHA_YEAR);
  });
});

describe('situacaoMapDataId', () => {
  test('names a group and year as cozinhas_<grupo>_<ano>', () => {
    expect(situacaoMapDataId({ grupo: 'nao_habilitadas', ano: 2025 })).toBe(
      'cozinhas_nao_habilitadas_2025'
    );
  });
});
