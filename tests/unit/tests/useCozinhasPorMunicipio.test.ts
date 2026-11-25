import { renderHook, waitFor } from '@testing-library/react';
import { useCozinhasPorMunicipio } from 'src/app/(features)/ia/useCozinhasPorMunicipio';

const SALVADOR = {
  codigoIbge: '2927408',
  municipio: 'SALVADOR',
  quantidade: 26,
  pessoasAtendidas: 45897,
  populacao: 2417678,
  porCemMil: 1.08,
  percentualDoBrasil: 1.87,
  pessoasCadUnico: 1157799,
  porDezMilCadUnico: 0.22,
  pessoasPorCozinha: 44531,
};

describe('useCozinhasPorMunicipio', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads the kitchen rows keyed by codigoIbge once enabled', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => {
        return Promise.resolve([SALVADOR]);
      },
    });

    const { result } = renderHook(() => {
      return useCozinhasPorMunicipio(true);
    });

    await waitFor(() => {
      expect(result.current.get('2927408')).toEqual(SALVADOR);
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/cozinhas/por-municipio');
  });

  test('fetches nothing while disabled', () => {
    global.fetch = jest.fn();

    const { result } = renderHook(() => {
      return useCozinhasPorMunicipio(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  test('stays empty when the rows fail to load', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => {
      return useCozinhasPorMunicipio(true);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    expect(result.current.size).toBe(0);
  });
});
