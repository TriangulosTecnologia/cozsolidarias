import type { VisualizationSpec } from '@ttoss/geovis';

import { DEFAULT_CAF_HEXBIN_OPACITY } from '@/app/(features)/mapas/geovisCafHexbin';
import { buildSpec } from '@/app/(features)/mapas/geovisSpec';
import { withMapaBoundaries } from '@/app/(features)/mapas/mapaBoundaries';
import { DEFAULT_COLOR_RAMP } from '@/app/(features)/mapas/mapaColorRamp';
import { gateway } from '@/gateway';

import { isRecord, type UnknownRecord } from './specValidation';

/**
 * Catalogue dataset ids the agent may emit for "cozinhas por município"; the
 * canonical spec renames them to `/mapas`'s own join id,
 * `cozinhas-por-municipio`.
 */
const COZINHAS_POR_MUNICIPIO_DATASET_IDS = ['cozinhas_geolocalizadas'];

const cozinhasMapDataIds = (spec: UnknownRecord): Set<string> => {
  const mapData = spec['mapData'];
  return new Set(
    (Array.isArray(mapData) ? mapData : []).flatMap((entry) => {
      const id = isRecord(entry) ? entry['mapDataId'] : undefined;
      return typeof id === 'string' &&
        COZINHAS_POR_MUNICIPIO_DATASET_IDS.includes(id)
        ? [id]
        : [];
    })
  );
};

/**
 * Whether the agent's spec asks for the cozinhas-per-município choropleth —
 * the one map this route renders from `/mapas`'s own builder instead of the
 * model's layers. Matches when a `mapData` entry is `cozinhas_geolocalizadas`
 * and the spec is a choropleth, either by `mapType` or by a polygon layer
 * bound to that entry.
 *
 * @param spec - The agent's validated spec.
 * @returns `true` when {@link buildCozinhasChoroplethSpec} should replace it.
 *
 * @example
 * isCozinhasChoroplethRequest({ mapType: 'choropleth', mapData: [{ mapDataId: 'cozinhas_geolocalizadas' }] }); // true
 */
export const isCozinhasChoroplethRequest = (spec: UnknownRecord): boolean => {
  const ids = cozinhasMapDataIds(spec);
  if (ids.size === 0) {
    return false;
  }
  if (spec['mapType'] === 'choropleth') {
    return true;
  }

  const layers = spec['layers'];
  return (Array.isArray(layers) ? layers : []).some((layer) => {
    return (
      isRecord(layer) &&
      layer['geometry'] === 'polygon' &&
      typeof layer['mapDataId'] === 'string' &&
      ids.has(layer['mapDataId'])
    );
  });
};

/**
 * `buildSpec` only emits `hoverTooltip.style` when a render is given. The
 * route serializes the spec to JSON, which drops the function and keeps the
 * style — the same shape `/mapas` exposes once its runtime has loaded.
 */
const renderNothing = (): null => {
  return null;
};

/**
 * Builds the cozinhas-per-município choropleth exactly as `/mapas` renders it
 * in `coropletico` mode: `buildSpec` over the gateway's per-município counts
 * (Jenks breaks fitted to the live values) and kitchen statuses, with the
 * settings tab's default opacity and ramp, plus the município/estado outlines. Keeps only the legends a layer actually shows,
 * dropping the other modes' legends `buildSpec` always declares. The
 * `cozinhas` source carries the fetched points; `cozinhas-bubbles` keeps its
 * `/api` URL for `appendRealSourceData` to resolve.
 *
 * @returns The canonical spec as plain JSON (render functions dropped).
 *
 * @example
 * const spec = await buildCozinhasChoroplethSpec();
 */
export const buildCozinhasChoroplethSpec = async (): Promise<UnknownRecord> => {
  const [byCity, cozinhas] = await Promise.all([
    gateway.getCozinhasPorMunicipio(),
    gateway.getCozinhas(),
  ]);
  const cozinhaStatus = Object.fromEntries(
    cozinhas.features.map((feature) => {
      return [feature.properties.codigo, feature.properties.emFuncionamento];
    })
  );

  const built = withMapaBoundaries(
    buildSpec(byCity, 'coropletico', renderNothing, [], {
      cozinhaStatus,
      cozinhaTooltipRender: renderNothing,
      // The settings tab's untouched defaults (see `MapaPlayground`'s
      // `paintSettings`), so the legend carries the same alpha and ramp.
      paintSettings: {
        fillOpacity: DEFAULT_CAF_HEXBIN_OPACITY,
        colorRamp: DEFAULT_COLOR_RAMP,
      },
    })
  );

  const legendIds = new Set(
    built.layers.flatMap((layer) => {
      return layer.activeLegendId ? [layer.activeLegendId] : [];
    })
  );
  const trimmed: VisualizationSpec = {
    ...built,
    legends: built.legends?.filter((legend) => {
      return legendIds.has(legend.id);
    }),
    sources: built.sources.map((source) => {
      return source.type === 'geojson' && source.id === 'cozinhas'
        ? { ...source, data: cozinhas }
        : source;
    }),
  };

  // JSON round-trip drops the render functions, leaving the plain spec.
  const plain: UnknownRecord = JSON.parse(JSON.stringify(trimmed));
  return plain;
};
