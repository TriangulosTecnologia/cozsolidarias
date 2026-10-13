import type { MapHoverInfo } from '@ttoss/geovis';

import type { KitchenEnabledShare2025 } from '@/data-gateway/schema';

import { TooltipCard } from './mapaTooltipCard';

/**
 * Tooltip reading numerator, denominator and percentage from the same snapshot.
 * @param params.snapshot - Canonical 2025 aggregate.
 * @param params.info - Hovered municipal feature, keyed by codarea.
 * @returns Municipal share or an explicit unavailable-data label.
 * @example renderEnabledShareTooltip({ snapshot, info });
 */
export const renderEnabledShareTooltip = ({
  snapshot,
  info,
}: {
  snapshot: KitchenEnabledShare2025 | null;
  info: MapHoverInfo;
}) => {
  const row = snapshot?.municipalities.find((entry) => {
    return entry.codigoIbge === String(info.featureId);
  });
  if (!snapshot || !row)
    return <TooltipCard name="2025" primary="Dado indisponível" />;
  return (
    <TooltipCard
      name={`${row.municipio} / ${row.uf}`}
      primary={`${row.sharePercent.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}% do total nacional`}
      secondary={`${row.enabledCount.toLocaleString('pt-BR')} habilitadas / ${snapshot.nationalTotal.toLocaleString('pt-BR')} cozinhas no Brasil · 2025`}
    />
  );
};
