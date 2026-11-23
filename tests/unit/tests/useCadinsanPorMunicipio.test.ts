import { renderHook, waitFor } from '@testing-library/react';
import { useCadinsanPorMunicipio } from 'src/app/(features)/ia/useCadinsanPorMunicipio';

const ALTAMIRA = {
  codigoIbge: '1500602',
  municipio: 'Altamira',
  uf: 'Pará',
  regiao: 'Norte',
  absolutoComPbf: 2616,
  absolutoSemPbf: 5779,
  cadastrosCadunico: 14656,
  proporcaoComPbf: 17.85,
  proporcaoSemPbf: 39.43,
};

describe('useCadinsanPorMunicipio', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads the CADINSAN rows keyed by codigoIbge once enabled', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => {
        return Promise.resolve([ALTAMIRA]);
      },
    });

    const { result } = renderHook(() => {
      return useCadinsanPorMunicipio(true);
    });

    await waitFor(() => {
      expect(result.current.get('1500602')).toEqual(ALTAMIRA);
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/cadinsan/por-municipio');
  });

  test('fetches nothing while disabled', () => {
    global.fetch = jest.fn();

    const { result } = renderHook(() => {
      return useCadinsanPorMunicipio(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  test('stays empty when the rows fail to load', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => {
      return useCadinsanPorMunicipio(true);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    expect(result.current.size).toBe(0);
  });
});
