import { buildConceptIndex } from 'src/app/api/ai/spec/conceptIndex';
import { preflightPrompt } from 'src/app/api/ai/spec/preflight';

import { gateway } from '@/gateway';

/**
 * The preflight's eval corpus: real-shaped prompts and the verdict each must
 * get. Rows are grouped by what the user can expect — a map as asked, a map
 * through a proxy, a question, or feedback — so a vocabulary change that moves
 * a prompt across groups shows up here first.
 */
const CORPUS: Array<{ prompt: string; verdict: string }> = [
  // A map as asked, or left to the agent.
  {
    prompt: 'Mapa do índice de vulnerabilidade social dos municípios',
    verdict: 'unmatched',
  },
  {
    prompt: 'Onde estão localizadas as cozinhas solidárias?',
    verdict: 'resolved',
  },
  { prompt: 'Mapa de cozinhas em 2025', verdict: 'resolved' },
  { prompt: 'IVS dos municípios em 2010', verdict: 'resolved' },
  { prompt: 'Mapa base do Brasil', verdict: 'unmatched' },
  { prompt: 'Mapa de estados do Brasil', verdict: 'unmatched' },
  // A map through an adjacent indicator.
  { prompt: 'Mapa da fome no Brasil', verdict: 'proxy' },
  { prompt: 'Onde há mais pobreza?', verdict: 'proxy' },
  // A question before generating.
  { prompt: 'IVS de infraestrutura e de renda', verdict: 'ambiguous' },
  // Feedback: no map as asked.
  { prompt: 'Mapa dos assentamentos rurais', verdict: 'feedback' },
  {
    prompt: 'Mapa de rodovias e aeroportos por município',
    verdict: 'feedback',
  },
  { prompt: 'IVS dos municípios em 2022', verdict: 'feedback' },
  { prompt: 'Mapa de cozinhas em 2030', verdict: 'feedback' },
  // A grain no dataset has.
  {
    prompt: 'Mapa da vulnerabilidade social por estado',
    verdict: 'unavailable',
  },
];

describe('preflight corpus', () => {
  test.each(CORPUS)('$prompt -> $verdict', async ({ prompt, verdict }) => {
    const concepts = buildConceptIndex(await gateway.getCatalogue());

    expect(preflightPrompt({ prompt, concepts }).status).toBe(verdict);
  });
});
