import {
  buildPessoasLegend,
  toPessoasRows,
} from 'src/app/(features)/mapas/geovisPessoas';
import type { kitchenRateByCity } from 'src/data-gateway/schema';

const register = (
  codigoIbge: string,
  pessoasAtendidas: number | null
): kitchenRateByCity => {
  return {
    codigoIbge,
    municipio: codigoIbge,
    quantidade: 1,
    pessoasAtendidas,
    populacao: null,
    porCemMil: null,
    percentualDoBrasil: 0,
    pessoasCadUnico: null,
    porDezMilCadUnico: null,
    pessoasPorCozinha: null,
  };
};

describe('toPessoasRows', () => {
  test('drops null totals but keeps zero', () => {
    expect(
      toPessoasRows([register('1', 120), register('2', null), register('3', 0)])
    ).toEqual([
      { geometryId: '1', value: 120 },
      { geometryId: '3', value: 0 },
    ]);
  });

  test('returns no rows for no registers', () => {
    expect(toPessoasRows([])).toEqual([]);
  });
});

describe('buildPessoasLegend', () => {
  test('is anchored bottom-right only when active', () => {
    expect(buildPessoasLegend(true)).toMatchObject({
      position: 'bottom-right',
      offset: 12,
    });
    expect(buildPessoasLegend(false).position).toBeUndefined();
    expect(buildPessoasLegend(false).offset).toBeUndefined();
  });
});
