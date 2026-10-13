import type { CadinsanByCity } from '@/data-gateway/schema';

export const coverageRisks: CadinsanByCity[] = [
  '3550308',
  '3304557',
  '3205309',
  '3136702',
  '2927408',
].map((codigoIbge, i) => {
  return {
    codigoIbge,
    municipio: `Município ${i}`,
    uf: 'SP',
    regiao: 'Sudeste',
    absolutoComPbf: i * 10,
    absolutoSemPbf: i * 10 + 10,
    cadastrosCadunico: 100,
    proporcaoComPbf: i * 10,
    proporcaoSemPbf: i * 10 + 10,
  };
});
