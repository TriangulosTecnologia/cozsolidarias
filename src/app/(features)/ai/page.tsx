import type { Metadata } from 'next';

import AiPlayground from './AiPlaygroundClient';

export const metadata: Metadata = {
  title: 'IA — Cozinha Solidária em Rede',
};

export default function AiPage() {
  return <AiPlayground />;
}
