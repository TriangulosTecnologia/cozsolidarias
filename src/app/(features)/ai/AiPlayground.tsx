'use client';

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
import * as React from 'react';

/** Submission lifecycle for the prompt-to-map form. */
type Status = 'idle' | 'loading' | 'error' | 'success';

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
  const [result, setResult] = React.useState<unknown>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (prompt.trim() === '' || status === 'loading') {
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/ai/spec', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const body = (await response.json()) as {
        result?: unknown;
        error?: string;
      };

      if (!response.ok) {
        setErrorMessage(body.error ?? 'Não foi possível gerar o mapa.');
        setStatus('error');
        return;
      }

      setResult(body.result);
      setStatus('success');
    } catch {
      setErrorMessage(
        'Falha de conexão. Verifique sua internet e tente novamente.'
      );
      setStatus('error');
    }
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

      {status === 'success' ? (
        <Box as="pre" bg="gray.100" p={4} borderRadius="md" overflow="auto">
          <Text as="code" fontSize="sm">
            {JSON.stringify(result, null, 2)}
          </Text>
        </Box>
      ) : null}
    </Stack>
  );
};

export default AiPlayground;
