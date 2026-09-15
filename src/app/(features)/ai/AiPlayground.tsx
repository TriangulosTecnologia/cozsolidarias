'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  Alert,
  Box,
  Button,
  Field,
  Heading,
  Spinner,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import type { VisualizationSpec } from '@ttoss/geovis';
import { GeovisWorkspace } from '@ttoss/geovis-workspace';
import { I18nProvider } from '@ttoss/react-i18n';
import { BruttalTheme } from '@ttoss/theme/Bruttal';
import * as React from 'react';
import { ThemeUIProvider } from 'theme-ui';

/** Submission lifecycle for the prompt-to-map form. */
type Status = 'idle' | 'loading' | 'error' | 'success';

/**
 * National camera fallback: frames the whole of Brazil. Applied when the
 * model's spec omits `view` — every município-level choropleth this route
 * can generate is national in scope, so this is always a sane default.
 */
const BRAZIL_VIEW = {
  center: [-53.0, -14.5] as [number, number],
  zoom: 4,
  maxZoomIn: 9,
  maxZoomOut: 4,
};

/** Outcome of one `POST /api/ai/spec` submission. */
type SubmitOutcome =
  | { ok: true; result: VisualizationSpec }
  | { ok: false; message: string };

/**
 * Calls `POST /api/ai/spec` with `prompt` and reduces every failure mode
 * (network failure, non-JSON body, non-2xx status, a 2xx with no `result`)
 * to a single pt-BR message — {@link AiPlayground.handleSubmit} only has to
 * branch on {@link SubmitOutcome.ok}.
 */
const submitPrompt = async (prompt: string): Promise<SubmitOutcome> => {
  let response: Response;
  try {
    response = await fetch('/api/ai/spec', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
  } catch {
    return {
      ok: false,
      message: 'Falha de conexão. Verifique sua internet e tente novamente.',
    };
  }

  let body: { result?: VisualizationSpec; error?: string };
  try {
    body = (await response.json()) as {
      result?: VisualizationSpec;
      error?: string;
    };
  } catch {
    return {
      ok: false,
      message: `O servidor respondeu com um conteúdo inesperado (status ${response.status}). Tente novamente.`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      message:
        body.error ??
        `O servidor recusou o pedido (status ${response.status}), sem detalhar o motivo.`,
    };
  }

  if (!body.result) {
    return {
      ok: false,
      message:
        body.error ??
        'O servidor respondeu com sucesso, mas sem a especificação do mapa ("result" ausente).',
    };
  }

  return { ok: true, result: body.result };
};

/**
 * `/ai` page body: a textarea prompt that calls `POST /api/ai/spec` and
 * renders the raw JSON returned by the model. Each submission replaces the
 * previous result — results never accumulate.
 *
 * @returns The prompt form, above the loading/error/result state for the
 * last submission.
 */
const AiPlayground = () => {
  const [prompt, setPrompt] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [result, setResult] = React.useState<VisualizationSpec | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (prompt.trim() === '' || status === 'loading') {
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    const outcome = await submitPrompt(prompt);
    if (!outcome.ok) {
      setErrorMessage(outcome.message);
      setStatus('error');
      return;
    }

    setResult(outcome.result);
    setStatus('success');
  };

  return (
    <Stack gap={6} p={{ base: 4, md: 8 }} maxW="container.lg" mx="auto">
      <Stack gap={2}>
        <Heading as="h1" size="lg">
          Peça um mapa
        </Heading>
        <Text color="fg.muted">
          Descreva em português o que você quer ver e a IA monta o mapa.
        </Text>
      </Stack>

      <form onSubmit={handleSubmit}>
        <Stack gap={4}>
          <Field.Root>
            <Field.Label htmlFor="ai-prompt">O que você quer ver?</Field.Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
              }}
              placeholder="Ex.: Quero ver o número total de pessoas atendidas pelas cozinhas solidárias por município"
              rows={3}
            />
          </Field.Root>
          <Box>
            <Button
              type="submit"
              colorPalette="orange"
              loading={status === 'loading'}
              disabled={prompt.trim() === ''}
            >
              Gerar mapa
            </Button>
          </Box>
        </Stack>
      </form>

      {status === 'loading' ? (
        <Stack direction="row" align="center" gap={3} role="status">
          <Spinner size="sm" />
          <Text color="fg.muted">Gerando mapa…</Text>
        </Stack>
      ) : null}

      {status === 'error' ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Não foi possível gerar o mapa</Alert.Title>
            <Alert.Description>{errorMessage}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : null}

      {status === 'success' && result ? (
        <Box
          position="relative"
          w="100%"
          h="85vh"
          minH="640px"
          borderRadius="md"
          overflow="hidden"
          css={{
            '& > *': {
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
            },
            '& > * > *': {
              flex: '1',
              minHeight: 0,
            },
          }}
        >
          <I18nProvider locale="pt-BR">
            <ThemeUIProvider theme={BruttalTheme}>
              <GeovisWorkspace
                config={{ appearance: 'bare' }}
                visualizationSpec={{
                  ...result,
                  view: result.view ?? BRAZIL_VIEW,
                }}
              />
            </ThemeUIProvider>
          </I18nProvider>

          {/* Deliberately public: the `/ai` page is an experimental, transparent
              playground — showing the raw generated spec lets anyone verify what
              the model actually produced (including the real `mapData` values
              after MapData Append). No secrets or personal data ever reach this
              payload (see route.ts's INSTRUCTIONS on municipal aggregation). Not
              gated behind a dev-only flag; revisit before treating `/ai` as a
              finished, non-experimental product surface. */}
          {JSON.stringify(result, null, 2) !== '{}' ? (
            <Box
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              maxH="50%"
              overflowY="auto"
              bgColor="bg.surface"
              borderTopWidth={1}
              borderTopColor="border.default"
              p={4}
            >
              <Heading as="h2" size="sm" mb={2}>
                Especificação do mapa
              </Heading>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Stack>
  );
};

export default AiPlayground;
