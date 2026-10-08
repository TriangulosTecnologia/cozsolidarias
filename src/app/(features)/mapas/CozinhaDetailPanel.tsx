import type { CozinhaDetalhe } from '@/data-gateway/schema';

import {
  colorForCozinhaStatus,
  cozinhaStatusLabel,
  cozinhaStatusShortLabel,
} from './geovisCozinhaStatusScales';

const field = (label: string, value: string) => {
  return (
    <>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#111827' }}>{value}</span>
    </>
  );
};

const formatLocalizacao = (cozinha: CozinhaDetalhe) => {
  const bairro = cozinha.bairro ? `${cozinha.bairro} · ` : '';
  const cep = cozinha.cep ? ` · CEP ${cozinha.cep}` : '';
  return `${bairro}${cozinha.municipio}/${cozinha.uf}${cep}`;
};

/**
 * Kitchen detail card for the right sidebar: name, status badge, opening
 * info, address and public served.
 *
 * @param props.cozinha - Detail record of the clicked kitchen.
 * @returns The detail markup.
 *
 * @example
 * <CozinhaDetailPanel cozinha={detail} />
 */
export const CozinhaDetailPanel = ({
  cozinha,
}: {
  cozinha: CozinhaDetalhe;
}) => {
  // Same derivation as the point color: the source-native `emFuncionamento` text
  // → descriptive label → terse label + point color, so the sidebar badge reads
  // Ativo/Reduzido/Inativo and matches the color painting the point on the map.
  const statusLabel = cozinhaStatusLabel(cozinha.emFuncionamento);
  const statusColor = colorForCozinhaStatus(statusLabel);
  const statusShort = cozinhaStatusShortLabel(statusLabel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span
          style={{ fontSize: '15px', fontWeight: 'bold', color: '#111827' }}
        >
          {cozinha.nome}
        </span>
        <span
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: '600',
            color: '#374151',
            backgroundColor: `${statusColor}22`,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '9999px',
              backgroundColor: statusColor,
            }}
          />
          {statusShort}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {field('Em funcionamento', cozinha.emFuncionamento || '—')}
        {cozinha.diasFuncionamento &&
          field('Dias de funcionamento', cozinha.diasFuncionamento)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {field('Endereço', cozinha.endereco)}
        <span style={{ fontSize: '11px', color: '#374151' }}>
          {formatLocalizacao(cozinha)}
        </span>
      </div>
      {cozinha.publicoAtendido && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {field('Público atendido', cozinha.publicoAtendido)}
          {cozinha.publicoTotalAtendido && (
            <span style={{ fontSize: '11px', color: '#374151' }}>
              {cozinha.publicoTotalAtendido} pessoas
            </span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
          {cozinha.codigo}
        </span>
      </div>
    </div>
  );
};
