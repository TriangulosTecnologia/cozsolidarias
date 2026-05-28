import type { Metadata } from 'next';

import { gateway } from '../../../gateway';

export const metadata: Metadata = {
  title: 'Mapas — Cozinhas Solidárias',
};

export default async function MapasPage() {
  const greeting = await gateway.getGreeting();

  return <h1>{greeting.text}</h1>;
}
