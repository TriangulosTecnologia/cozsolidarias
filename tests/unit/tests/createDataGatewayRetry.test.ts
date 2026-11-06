import { createDataGateway } from 'src/data-gateway/createDataGateway';
import { readStaticCadinsanMunicipal } from 'src/data-source-static/readStaticCadinsanMunicipal';
import { readStaticCozinhas } from 'src/data-source-static/readStaticCozinhas';
import { readStaticIvs } from 'src/data-source-static/readStaticIvs';
import { readStaticMunicipios } from 'src/data-source-static/readStaticMunicipios';

jest.mock('src/data-source-static/readStaticIvs');
jest.mock('src/data-source-static/readStaticCadinsanMunicipal');
jest.mock('src/data-source-static/readStaticMunicipios');
jest.mock('src/data-source-static/readStaticCozinhas', () => {
  return {
    ...jest.requireActual('src/data-source-static/readStaticCozinhas'),
    readStaticCozinhas: jest.fn(),
  };
});

const failure = new Error('read failed');

describe('createDataGateway memoization', () => {
  test('does not keep a failed IVS read: the next call retries', async () => {
    const read = jest.mocked(readStaticIvs);
    read.mockRejectedValueOnce(failure).mockResolvedValue([]);
    const gateway = createDataGateway();

    await expect(gateway.getIvsPorMunicipio()).rejects.toBe(failure);
    await expect(gateway.getIvsPorMunicipio()).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  test('does not keep a failed CADINSAN read: the next call retries', async () => {
    const read = jest.mocked(readStaticCadinsanMunicipal);
    read.mockRejectedValueOnce(failure).mockResolvedValue([]);
    const gateway = createDataGateway();

    await expect(gateway.getCadinsanPorMunicipio()).rejects.toBe(failure);
    await expect(gateway.getCadinsanPorMunicipio()).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  test('does not keep a failed aggregate or situação snapshot: the next call retries', async () => {
    jest
      .mocked(readStaticCozinhas)
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue([]);
    jest
      .mocked(readStaticMunicipios)
      .mockResolvedValue({ type: 'FeatureCollection', features: [] });
    const gateway = createDataGateway();

    await expect(gateway.getCozinhasSituacaoPorMunicipio(2026)).rejects.toBe(
      failure
    );
    await expect(
      gateway.getCozinhasSituacaoPorMunicipio(2026)
    ).resolves.toMatchObject({ porMunicipio: [], semLocalizacao: 0 });
  });
});
