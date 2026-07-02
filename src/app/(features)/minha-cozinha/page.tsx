import type { Metadata } from 'next';

import MinhaCozinha from './MinhaCozinha';

export const metadata: Metadata = {
  title: 'Minha Cozinha — Cozinha Solidária em Rede',
};

export default function MinhaCozinhaPage() {
  return <MinhaCozinha />;
}
