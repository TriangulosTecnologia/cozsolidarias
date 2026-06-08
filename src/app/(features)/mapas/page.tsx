import type { Metadata } from 'next';

import MapaPlayground from './MapaPlayground';

export const metadata: Metadata = {
  title: 'Mapas — Cozinha Solidária em Rede',
};

export default function MapasPage() {
  return <MapaPlayground />;
}
