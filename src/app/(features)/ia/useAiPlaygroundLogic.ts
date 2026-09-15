import type { VisualizationSpec } from '@ttoss/geovis';
import * as React from 'react';

/** Submission lifecycle for the prompt-to-map form. */
type Status = 'idle' | 'loading' | 'error' | 'success';

/** Error diagnostic details from API (raw spec + validation issues). */
type ErrorDetails = {
  issues?: Array<{ code: string; message: string }>;
  spec?: unknown;
};

/** Outcome of one `POST /api/ai/spec` submission. */
type SubmitOutcome =
  | { ok: true; result: VisualizationSpec }
  | { ok: false; message: string; details?: ErrorDetails };

/**
 * Calls `POST /api/ai/spec` with `prompt` and reduces every failure mode
 * (network failure, non-JSON body, non-2xx status, a 2xx with no `result`)
 * to a single pt-BR message — {@link useAiPlaygroundLogic.handleSubmit} only
 * has to branch on {@link SubmitOutcome.ok}. When the server attaches `spec`
 * and/or `issues` to an error body, they are carried in `details` so the
 * caller can offer them for inspection.
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

  let body: {
    result?: VisualizationSpec;
    error?: string;
    issues?: Array<{ code: string; message: string }>;
    spec?: unknown;
  };
  try {
    body = (await response.json()) as {
      result?: VisualizationSpec;
      error?: string;
      issues?: Array<{ code: string; message: string }>;
      spec?: unknown;
    };
  } catch {
    return {
      ok: false,
      message: `O servidor respondeu com um conteúdo inesperado (status ${response.status}). Tente novamente.`,
    };
  }

  const details =
    body.issues || body.spec
      ? { issues: body.issues, spec: body.spec }
      : undefined;

  if (!response.ok) {
    return {
      ok: false,
      message:
        body.error ??
        `O servidor recusou o pedido (status ${response.status}), sem detalhar o motivo.`,
      details,
    };
  }

  if (!body.result) {
    return {
      ok: false,
      message:
        body.error ??
        'O servidor respondeu com sucesso, mas sem a especificação do mapa ("result" ausente).',
      details,
    };
  }

  return { ok: true, result: body.result };
};

export const useAiPlaygroundLogic = () => {
  const [prompt, setPrompt] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [result, setResult] = React.useState<VisualizationSpec | null>(null);
  const [showJson, setShowJson] = React.useState(false);
  const [errorDetails, setErrorDetails] = React.useState<ErrorDetails | null>(
    null
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (prompt.trim() === '' || status === 'loading') {
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    setShowJson(false);

    const outcome = await submitPrompt(prompt);

    if (!outcome.ok) {
      setErrorMessage(outcome.message);
      setErrorDetails(outcome.details ?? null);
      setStatus('error');
      return;
    }

    setResult(outcome.result);
    setErrorDetails(null);
    setStatus('success');
  };

  return {
    prompt,
    setPrompt,
    status,
    errorMessage,
    result,
    showJson,
    setShowJson,
    errorDetails,
    handleSubmit,
  };
};
