import type { Metadata } from 'next';

import AiPlayground from './AiPlayground';

export const metadata: Metadata = {
  title: 'IA — Cozinha Solidária em Rede',
};

export default function AiPage() {
  return <AiPlayground />;
}
