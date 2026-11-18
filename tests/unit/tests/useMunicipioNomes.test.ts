import { renderHook, waitFor } from '@testing-library/react';
import { useMunicipioNomes } from 'src/app/(features)/ia/useMunicipioNomes';

describe('useMunicipioNomes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads the codarea → name map from /geo/municipios-nomes.json', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => {
        return Promise.resolve({ '3304557': 'Rio de Janeiro' });
      },
    });

    const { result } = renderHook(() => {
      return useMunicipioNomes();
    });

    await waitFor(() => {
      expect(result.current).toEqual({ '3304557': 'Rio de Janeiro' });
    });
    expect(global.fetch).toHaveBeenCalledWith('/geo/municipios-nomes.json');
  });

  test('stays empty when the file fails to load', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => {
      return useMunicipioNomes();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    expect(result.current).toEqual({});
  });
});
