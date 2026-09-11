import type { StaticCafPontosSource } from '../../data-source-static/types';
import type { cafByCity, CafUfFeatureCollection } from '../schema';

/**
 * Totals the CAF counts by federative unit, keyed by the two-digit prefix every
 * IBGE municipality code starts with.
 *
 * Grouping by the código rather than by a UF field is what lets every município
 * count, including the six created after the 2010 geometry vintage: they have no
 * polygon, so they cannot pull a UF's anchor position, but their CAFs are as
 * real as any other's.
 */
const totalsByCodigoUf = (porMunicipio: cafByCity[]): Map<string, number> => {
  const totals = new Map<string, number>();

  for (const { codigoIbge, quantidade } of porMunicipio) {
    const codigoUf = codigoIbge.slice(0, 2);
    totals.set(codigoUf, (totals.get(codigoUf) ?? 0) + quantidade);
  }

  return totals;
};

/**
 * Joins the UF anchors to their CAF counts, producing the GeoJSON the map's
 * country level renders.
 *
 * The counts come from `caf-por-municipio.json` alone — the anchors carry
 * position and nothing else — so the 27 totals here and the município
 * choropleth's national figure are two projections of one number, and cannot
 * drift.
 *
 * @param params.anchors - Positions from `caf-pontos.json`.
 * @param params.porMunicipio - Canonical per-município CAF rows (the count
 * authority).
 * @returns One Point feature per UF, sized and labelled by its CAF total.
 *
 * @example
 * toCafUfPontos({
 *   anchors: { ufs: [{ codigoUf: '29', uf: 'BA', nome: 'Bahia', longitude: -40.77, latitude: -12.34 }] },
 *   porMunicipio: [{ codigoIbge: '2910800', municipio: 'Feira de Santana', quantidade: 8412, percentualDoBrasil: 0.215 }],
 * });
 * // { type: 'FeatureCollection', features: [{ properties: { nome: 'Bahia', quantidade: 8412 }, ... }] }
 */
export const toCafUfPontos = ({
  anchors,
  porMunicipio,
}: {
  anchors: StaticCafPontosSource;
  porMunicipio: cafByCity[];
}): CafUfFeatureCollection => {
  const totals = totalsByCodigoUf(porMunicipio);

  const features = anchors.ufs.map((anchor) => {
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [anchor.longitude, anchor.latitude] as [number, number],
      },
      properties: {
        nome: anchor.nome,
        quantidade: totals.get(anchor.codigoUf) ?? 0,
      },
    };
  });

  return { type: 'FeatureCollection', features };
};
