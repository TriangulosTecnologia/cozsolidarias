import type { Metadata } from 'next';

import MapaPlayground from './MapaPlayground';

export const metadata: Metadata = {
  title: 'Mapas — Cozinhas Solidárias',
};

export default function MapasPage() {
  return <MapaPlayground />;
}
