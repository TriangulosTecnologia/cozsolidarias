import { useGeoVis } from '@ttoss/geovis';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import * as React from 'react';

import type { KitchenEnabledShare2025 } from '@/data-gateway/schema';

import { coverageRadius } from './municipalKitchenCoverage';
import { municipalPieSvg } from './municipalKitchenPie';

/** Native markers follow the camera; the underlying spec circles own hover. */
const MunicipalKitchenSymbols = ({
  snapshot,
  visible,
}: {
  snapshot: KitchenEnabledShare2025 | null;
  visible: boolean;
}) => {
  const { runtime } = useGeoVis();
  React.useEffect(() => {
    if (!visible || !snapshot || !runtime) return;
    const map = runtime.getAdapter().getNativeInstance() as MapLibreMap;
    const maximum = Math.max(
      2,
      ...snapshot.municipalCoverage.map((row) => {
        return row.registeredCount;
      })
    );
    let disposed = false;
    let markers: Marker[] = [];
    void import('maplibre-gl').then(({ Marker }) => {
      if (disposed) return;
      markers = [...snapshot.municipalCoverage]
        .sort((a, b) => {
          return b.registeredCount - a.registeredCount;
        })
        .map((row) => {
          const element = document.createElement('div');
          const diameter =
            (2 * coverageRadius(row.registeredCount, maximum) * 40) / 38;
          element.style.cssText = `width:${diameter}px;height:${diameter}px;pointer-events:none;`;
          element.setAttribute('aria-hidden', 'true');
          element.innerHTML = municipalPieSvg(
            row.enabledPercent,
            row.registeredCount < 5
          );
          return new Marker({ element }).setLngLat(row.anchor).addTo(map);
        });
    });
    return () => {
      disposed = true;
      for (const marker of markers) marker.remove();
    };
  }, [runtime, snapshot, visible]);
  return null;
};
export default MunicipalKitchenSymbols;
