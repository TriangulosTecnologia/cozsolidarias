import type { StaticCozinhaSource } from '../../data-source-static/types';
import type { CozinhaDetalhe } from '../schema';

/**
 * Projects a source-native cozinha record into the canonical
 * {@link CozinhaDetalhe} contract, keeping only the descriptive fields
 * (identity, location, operation, público atendido) and dropping the source's
 * contact/PII columns (email, telefone, CNPJ) and its internal review-workflow
 * columns (avaliador, homologador, analysis/homologation dates, …).
 *
 * @param source - Raw record from data-source-static.
 * @returns The canonical detail for one cozinha.
 *
 * @example
 * toCozinhaDetalhe(source);
 * // { codigo: 'CS016282', nome: 'Ação Cristã…', municipio: 'Rio de Janeiro', … }
 */
export const toCozinhaDetalhe = (
  source: StaticCozinhaSource
): CozinhaDetalhe => {
  return {
    codigo: source.codigo,
    nome: source.nome,
    endereco: source.endereco,
    bairro: source.bairro,
    cep: source.cep,
    municipio: source.municipio,
    uf: source.uf,
    emFuncionamento: source.emFuncionamento,
    diasFuncionamento: source.diasFuncionamento,
    situacao: source.situacao,
    publicoAtendido: source.publicoAtendido,
    publicoTotalAtendido: source.publicoTotalAtendido,
    dataUltimaAtualizacao: source.dataUltimaAtualizacao,
    latitude: source.latitude,
    longitude: source.longitude,
    enderecoCompleto: source.enderecoCompleto,
  };
};
