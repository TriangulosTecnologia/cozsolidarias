'use client';

import { Alert, Box, Button, Stack, Text } from '@chakra-ui/react';

import type {
  ChoiceOption,
  Clarification,
  Issue,
  Requirement,
} from './submitPrompt';
import type { Choice } from './useAiPlaygroundLogic';

type OnChoose = (choice: Choice) => void;

/**
 * The error alert of a failed submission: the server's message, then what to
 * fix (`requirements`) or, when it sent none, the raw validation `issues`.
 */
export const ErrorAlert = ({
  failure,
}: {
  failure: {
    message: string;
    issues: Issue[];
    requirements: Requirement[];
  };
}) => {
  const lines =
    failure.requirements.length > 0
      ? failure.requirements.map((requirement) => {
          return { key: requirement.code, text: requirement.fix };
        })
      : failure.issues.map((issue) => {
          return { key: issue.code, text: issue.message };
        });

  return (
    <Alert.Root status="error">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Não foi possível gerar o mapa</Alert.Title>
        <Alert.Description>
          {failure.message}
          {lines.length > 0 && (
            <Box as="ul" pl={5} mt={2}>
              {lines.map((line, index) => {
                return <li key={`${line.key}-${index}`}>{line.text}</li>;
              })}
            </Box>
          )}
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
};

/**
 * The question the server asked before generating, one button per answer; the
 * server's suggested answer is marked.
 */
const ClarifyPanel = ({
  clarify,
  onChoose,
}: {
  clarify: Clarification;
  onChoose: OnChoose;
}) => {
  return (
    <Alert.Root status="info">
      <Alert.Content>
        <Alert.Title>{clarify.question}</Alert.Title>
        <Stack direction="row" wrap="wrap" gap={2} mt={3}>
          {clarify.options.map((option) => {
            return (
              <Button
                key={option.value}
                size="sm"
                variant={option.value === clarify.default ? 'solid' : 'outline'}
                onClick={() => {
                  onChoose({ facet: clarify.facet, value: option.value });
                }}
              >
                {option.value === clarify.default
                  ? `${option.label} (sugerido)`
                  : option.label}
              </Button>
            );
          })}
        </Stack>
      </Alert.Content>
    </Alert.Root>
  );
};

/** Offers every available map type, so another one is always one click away. */
const MapTypePicker = ({
  options,
  onChoose,
}: {
  options: ChoiceOption[];
  onChoose: OnChoose;
}) => {
  return (
    <Stack role="group" aria-label="Tentar outro tipo de mapa" gap={2}>
      <Text color="fg.muted">Tentar outro tipo de mapa:</Text>
      <Stack direction="row" wrap="wrap" gap={2}>
        {options.map((option) => {
          return (
            <Button
              key={option.value}
              size="sm"
              variant="outline"
              onClick={() => {
                onChoose({ facet: 'mapType', value: option.value });
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </Stack>
    </Stack>
  );
};

/**
 * What the user can answer next: the server's question while it waits for
 * one, otherwise the map types after a result or a failure.
 */
export const ChoiceSection = ({
  status,
  clarify,
  mapTypeOptions,
  onChoose,
}: {
  status: string;
  clarify: Clarification | null;
  mapTypeOptions: ChoiceOption[];
  onChoose: OnChoose;
}) => {
  if (status === 'clarify' && clarify) {
    return <ClarifyPanel clarify={clarify} onChoose={onChoose} />;
  }
  if ((status === 'success' || status === 'error') && mapTypeOptions.length) {
    return <MapTypePicker options={mapTypeOptions} onChoose={onChoose} />;
  }
  return null;
};
