import type { GeovisWorkspaceConfig } from '@ttoss/geovis-workspace';

import type {
  CafDetalhe,
  CafProducaoItem,
  CozinhaDetalhe,
} from '@/data-gateway/schema';

import {
  CAFS_POINTS_LAYER_ID,
  COZINHAS_POINTS_LAYER_ID,
  type MapMode,
} from './geovisSpec';

// Persists the last successfully loaded kitchen so non-point clicks (e.g.
// municipalities) keep showing the same detail instead of clearing the sidebar.
// Synchronous return skips the workspace's loading state for those clicks.
let lastCozinhaDetail: CozinhaDetalhe | null = null;

// Persists the last loaded CAF detail across non-point-layer clicks.
let lastCafDetalhe: CafDetalhe | null = null;

const field = (label: string, value: string) => {
  return (
    <>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#111827' }}>{value}</span>
    </>
  );
};

const formatBrl = (value: number | null): string => {
  if (value === null) return '—';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const CafDetailPanel = ({ detalhe }: { detalhe: CafDetalhe }) => {
  if (detalhe.producao.length === 0) {
    return (
      <span style={{ fontSize: '13px', color: '#6b7280' }}>
        Nenhum dado encontrado
      </span>
    );
  }

  const byCategoria = new Map<string, CafProducaoItem[]>();
  for (const item of detalhe.producao) {
    const existing = byCategoria.get(item.categoriaRenda);
    if (existing) {
      existing.push(item);
    } else {
      byCategoria.set(item.categoriaRenda, [item]);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[...byCategoria.entries()].map(([categoria, items]) => {
        return (
          <div
            key={categoria}
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {categoria}
            </span>
            {items.map((item, i) => {
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    paddingLeft: '8px',
                    borderLeft: '2px solid #e5e7eb',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      color: '#111827',
                      fontWeight: 500,
                    }}
                  >
                    {item.dsProduto}
                  </span>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    {item.dsTipoRenda}
                  </span>
                  <span style={{ fontSize: '12px', color: '#374151' }}>
                    R$ {formatBrl(item.vlRendaAuferida)} auferida · R${' '}
                    {formatBrl(item.vlRendaEstimada)} estimada
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
        CAF {detalhe.nrCaf}
      </span>
    </div>
  );
};

const CozinhaDetailPanel = ({ cozinha }: { cozinha: CozinhaDetalhe }) => {
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
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: '600',
            color: '#166534',
            backgroundColor: '#dcfce7',
          }}
        >
          {cozinha.situacao}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {field('Em funcionamento', cozinha.emFuncionamento || '—')}
        {cozinha.diasFuncionamento &&
          field('Dias de funcionamento', cozinha.diasFuncionamento)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {field('Endereço', cozinha.enderecoCompleto || cozinha.endereco)}
        <span style={{ fontSize: '11px', color: '#374151' }}>
          {cozinha.bairro ? `${cozinha.bairro} · ` : ''}
          {cozinha.municipio}/{cozinha.uf}
          {cozinha.cep ? ` · CEP ${cozinha.cep}` : ''}
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
        {cozinha.dataUltimaAtualizacao && (
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            Atualizado em {cozinha.dataUltimaAtualizacao}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Right sidebar config for the CAF points mode. Fetches the clicked CAF's
 * detail from `/api/cafs/[nrCaf]`, falling back to an empty production list on
 * 404 and to the last loaded detail on other errors.
 *
 * @example
 * <GeovisWorkspace config={{ rightSidebar: CAF_RIGHT_SIDEBAR }} ... />
 */
export const CAF_RIGHT_SIDEBAR: NonNullable<
  GeovisWorkspaceConfig['rightSidebar']
> = {
  title: 'CAF',
  shouldOpen: (info) => {
    return info.layerId === CAFS_POINTS_LAYER_ID;
  },
  onFeatureSelect: (info) => {
    return fetch(`/api/cafs/${info.featureId}`).then(async (response) => {
      if (response.status === 404) {
        return { nrCaf: String(info.featureId), producao: [] };
      }
      if (!response.ok) {
        return lastCafDetalhe;
      }
      const detalhe = (await response.json()) as CafDetalhe;
      lastCafDetalhe = detalhe;
      return detalhe;
    });
  },
  renderDetails: ({ loading, error, data }) => {
    if (loading) {
      return (
        <span style={{ fontSize: '14px', color: '#6b7280' }}>Carregando…</span>
      );
    }
    if (error || !data) return null;
    return <CafDetailPanel detalhe={data as CafDetalhe} />;
  },
};

/**
 * Right sidebar config for modes that show clickable kitchen points. Fetches
 * the clicked kitchen's detail from `/api/cozinhas/[codigo]`, keeping the last
 * loaded detail visible on error.
 *
 * @example
 * <GeovisWorkspace config={{ rightSidebar: COZINHA_RIGHT_SIDEBAR }} ... />
 */
export const COZINHA_RIGHT_SIDEBAR: NonNullable<
  GeovisWorkspaceConfig['rightSidebar']
> = {
  title: 'Cozinha Solidária',
  shouldOpen: (info) => {
    return info.layerId === COZINHAS_POINTS_LAYER_ID;
  },
  onFeatureSelect: (info) => {
    return fetch(`/api/cozinhas/${info.featureId}`).then(async (response) => {
      if (!response.ok) return lastCozinhaDetail;
      const detail = (await response.json()) as CozinhaDetalhe;
      lastCozinhaDetail = detail;
      return detail;
    });
  },
  renderDetails: ({ loading, error, data }) => {
    if (loading) {
      return (
        <span style={{ fontSize: '14px', color: '#6b7280' }}>Carregando…</span>
      );
    }
    if (error || !data) return null;
    return <CozinhaDetailPanel cozinha={data as CozinhaDetalhe} />;
  },
};

/** Modes that render the kitchen points layer and expose the detail sidebar. */
export const MODES_WITH_RIGHT_SIDEBAR = new Set<MapMode>([
  'pontos',
  'assentamentos',
]);
