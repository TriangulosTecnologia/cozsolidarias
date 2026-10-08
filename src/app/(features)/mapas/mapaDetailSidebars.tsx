import type { GeovisWorkspaceConfig } from '@ttoss/geovis-workspace';

import type { CozinhaDetalhe } from '@/data-gateway/schema';

import { CozinhaDetailPanel } from './CozinhaDetailPanel';
import { COZINHAS_POINTS_LAYER_ID, type MapMode } from './geovisSpec';

// Persists the last successfully loaded kitchen so non-point clicks (e.g.
// municipalities) keep showing the same detail instead of clearing the sidebar.
// Synchronous return skips the workspace's loading state for those clicks.
let lastCozinhaDetail: CozinhaDetalhe | null = null;

/**
 * Fetches a kitchen's detail from `/api/cozinhas/[codigo]`, keeping the last
 * loaded detail visible on error. The year is required: the endpoint looks the
 * código up inside that year's snapshot, and the snapshots cover different
 * populations, so omitting it 404s for any kitchen absent from the latest one.
 */
const fetchCozinhaDetail = ({
  codigo,
  year,
}: {
  codigo: string | number;
  year: number;
}): Promise<CozinhaDetalhe | null> => {
  return fetch(`/api/cozinhas/${codigo}?ano=${year}`).then(async (response) => {
    if (!response.ok) return lastCozinhaDetail;
    const detail = (await response.json()) as CozinhaDetalhe;
    lastCozinhaDetail = detail;
    return detail;
  });
};

/**
 * Builds the right sidebar config for modes that show clickable kitchen points.
 * Fetches the clicked kitchen's detail from `/api/cozinhas/[codigo]`, keeping
 * the last loaded detail visible on error.
 *
 * Takes the displayed year rather than being a constant because the lookup is
 * snapshot-scoped: the click must resolve against the same year the point was
 * plotted from, otherwise kitchens absent from the latest snapshot 404 and the
 * sidebar never opens.
 *
 * @param year - The snapshot year currently on the map.
 * @returns The `rightSidebar` config bound to that year.
 *
 * @example
 * <GeovisWorkspace config={{ rightSidebar: buildCozinhaRightSidebar(2025) }} ... />
 */
export const buildCozinhaRightSidebar = (
  year: number
): NonNullable<GeovisWorkspaceConfig['rightSidebar']> => {
  return {
    title: 'Cozinha Solidária',
    shouldOpen: (info) => {
      return info.layerId === COZINHAS_POINTS_LAYER_ID;
    },
    onFeatureSelect: (info) => {
      return fetchCozinhaDetail({ codigo: info.featureId, year });
    },
    renderDetails: ({ loading, error, data }) => {
      if (loading) {
        return (
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Carregando…
          </span>
        );
      }
      if (error || !data) return null;
      return <CozinhaDetailPanel cozinha={data as CozinhaDetalhe} />;
    },
  };
};

/**
 * Whether the given mode exposes the kitchen detail sidebar
 * ({@link buildCozinhaRightSidebar}). True for `pontos` and `assentamentos` (points
 * always shown) and for every choropleth (`coropletico*`), where the points are
 * an opt-in overlay whose clicks should still open the kitchen detail.
 * `circulos` is excluded (bubbles carry no click detail).
 *
 * @param mode - Active {@link MapMode}.
 * @returns `true` when the kitchen detail sidebar applies.
 *
 * @example
 * modeShowsCozinhaDetail('coropletico'); // true
 * modeShowsCozinhaDetail('circulos'); // false
 */
export const modeShowsCozinhaDetail = (mode: MapMode): boolean => {
  return (
    mode === 'pontos' ||
    mode === 'assentamentos' ||
    mode.startsWith('coropletico')
  );
};
