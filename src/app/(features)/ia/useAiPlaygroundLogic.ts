import type { VisualizationSpec } from '@ttoss/geovis';
import * as React from 'react';

import {
  type ChoiceOption,
  type Choices,
  type Clarification,
  type Issue,
  type Requirement,
  type SubmitOutcome,
  submitPrompt,
} from './submitPrompt';

/** Submission lifecycle for the prompt-to-map form. */
type Status = 'idle' | 'loading' | 'error' | 'success' | 'clarify';

/** An answer to a question or a map-type pick, ready to resubmit. */
export type Choice = { facet: 'dataset' | 'mapType'; value: string };

/** Everything a failed submission leaves for the user to read. */
type Failure = {
  message: string;
  issues: Issue[];
  requirements: Requirement[];
  spec: unknown;
};

const NO_FAILURE: Failure = {
  message: '',
  issues: [],
  requirements: [],
  spec: null,
};

export const useAiPlaygroundLogic = () => {
  const [prompt, setPrompt] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [failure, setFailure] = React.useState<Failure>(NO_FAILURE);
  const [result, setResult] = React.useState<VisualizationSpec | null>(null);
  const [showJson, setShowJson] = React.useState(false);
  const [spec, setSpec] = React.useState<unknown>(null);
  const [clarify, setClarify] = React.useState<Clarification | null>(null);
  const [mapTypeOptions, setMapTypeOptions] = React.useState<ChoiceOption[]>(
    []
  );
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  // Answers given since the last prompt, kept so a later question doesn't re-ask an earlier one.
  const [answers, setAnswers] = React.useState<Choices>({});

  const apply = (outcome: SubmitOutcome) => {
    setSessionId(outcome.sessionId);
    setMapTypeOptions(outcome.mapTypeOptions);
    if (outcome.kind === 'clarify') {
      setClarify(outcome.clarify);
      setStatus('clarify');
    } else if (outcome.kind === 'failure') {
      setFailure({ ...outcome, spec: outcome.spec ?? null });
      setSpec(outcome.spec ?? null);
      setStatus('error');
    } else {
      setResult(outcome.result);
      setSpec(outcome.result);
      setStatus('success');
    }
  };

  const run = async (choices: Choices) => {
    setStatus('loading');
    setFailure(NO_FAILURE);
    setClarify(null);
    setShowJson(false);
    apply(await submitPrompt({ prompt, ...choices }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (prompt.trim() === '' || status === 'loading') {
      return;
    }
    setAnswers({});
    await run({});
  };

  const choose = async (choice: Choice) => {
    // A choice continues the conversation that raised it.
    const answer =
      choice.facet === 'mapType'
        ? { mapType: choice.value }
        : { datasetId: choice.value };
    const next = { ...answers, ...answer };
    setAnswers(next);
    await run({ ...next, sessionId: sessionId ?? undefined });
  };

  return {
    prompt,
    setPrompt,
    status,
    failure,
    result,
    showJson,
    setShowJson,
    spec,
    clarify,
    mapTypeOptions,
    handleSubmit,
    choose,
  };
};
