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
import { ThemeUIProvider } from 'theme-ui';

import { JsonPanel } from './JsonPanel';
import { useAiPlaygroundLogic } from './useAiPlaygroundLogic';

const BRAZIL_VIEW = {
  center: [-53.0, -14.5] as [number, number],
  zoom: 4,
  maxZoomIn: 9,
  maxZoomOut: 4,
};

/**
 * Renders the map workspace for a successful submission, plus the
 * deliberately-public raw spec panel. Extracted from `AiPlayground` to keep
 * that component's cyclomatic complexity within the lint threshold.
 */
const MapResultView = ({
  result,
  showJson,
}: {
  result: VisualizationSpec;
  showJson: boolean;
}) => {
  const hasSpec = showJson && JSON.stringify(result, null, 2) !== '{}';

  return (
    <Stack
      gap={0}
      w="100%"
      h="calc(100vh - 240px)"
      minH="640px"
      borderRadius="md"
      overflow="hidden"
    >
      <Box
        flex="1"
        minH={0}
        css={{
          '& > *': {
            height: '100%',
            width: '100%',
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
      </Box>

      {/* Deliberately public: the `/ai` page is an experimental, transparent
          playground — showing the raw generated spec lets anyone verify what
          the model actually produced (including the real `mapData` values
          after MapData Append). No secrets or personal data ever reach this
          payload (see route.ts's INSTRUCTIONS on municipal aggregation). Not
          gated behind a dev-only flag; revisit before treating `/ai` as a
          finished, non-experimental product surface. */}
      {hasSpec ? (
        <Box
          flex="0 0 auto"
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
    </Stack>
  );
};

const AiPlayground = () => {
  const {
    prompt,
    setPrompt,
    status,
    errorMessage,
    result,
    showJson,
    setShowJson,
    errorDetails,
    handleSubmit,
  } = useAiPlaygroundLogic();

  const jsonPayload =
    status === 'success' && result
      ? result
      : status === 'error' && errorDetails
        ? errorDetails
        : null;

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

      {status === 'loading' && (
        <Stack direction="row" align="center" gap={3} role="status">
          <Spinner size="sm" />
          <Text color="fg.muted">Gerando mapa…</Text>
        </Stack>
      )}

      {status === 'error' && (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Não foi possível gerar o mapa</Alert.Title>
            <Alert.Description>{errorMessage}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <JsonPanel
        jsonPayload={jsonPayload}
        showJson={showJson}
        onToggle={() => {
          return setShowJson((prev) => {
            return !prev;
          });
        }}
      />

      {status === 'success' && result && (
        <MapResultView result={result} showJson={showJson} />
      )}
    </Stack>
  );
};

export default AiPlayground;
