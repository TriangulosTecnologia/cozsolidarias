import type { VisualizationSpec } from '@ttoss/geovis';
import * as React from 'react';

/** Submission lifecycle for the prompt-to-map form. */
type Status = 'idle' | 'loading' | 'error' | 'success';

/** One validation issue reported by `POST /api/ai/spec`. */
type Issue = { code: string; message: string; path?: string };

/** Error diagnostic details from API (validation issues behind the failure). */
type ErrorDetails = {
  issues?: Issue[];
};

/** Body of every `POST /api/ai/spec` response (see the route's `POST`). */
type SpecResponseBody = {
  spec?: unknown;
  error?: boolean;
  message?: string;
  issues?: Issue[];
};

/**
 * Outcome of one `POST /api/ai/spec` submission. `spec` is carried on failure
 * too, whenever the server generated one, so it can always be inspected.
 */
type SubmitOutcome =
  | { ok: true; result: VisualizationSpec }
  | { ok: false; message: string; details?: ErrorDetails; spec?: unknown };

const isVisualizationSpec = (value: unknown): value is VisualizationSpec => {
  return typeof value === 'object' && value !== null && 'layers' in value;
};

/**
 * Calls `POST /api/ai/spec` with `prompt` and reduces every failure mode
 * (network failure, non-JSON body, `error: true`, a success with no `spec`)
 * to a single pt-BR message — {@link useAiPlaygroundLogic.handleSubmit} only
 * has to branch on {@link SubmitOutcome.ok}. The server's `spec` and `issues`
 * are carried on failure so the caller can offer them for inspection.
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

  let body: SpecResponseBody;
  try {
    body = (await response.json()) as SpecResponseBody;
  } catch {
    return {
      ok: false,
      message: `O servidor respondeu com um conteúdo inesperado (status ${response.status}). Tente novamente.`,
    };
  }

  const details = body.issues ? { issues: body.issues } : undefined;

  if (!response.ok || body.error !== false) {
    return {
      ok: false,
      message:
        body.message ??
        `O servidor recusou o pedido (status ${response.status}), sem detalhar o motivo.`,
      details,
      spec: body.spec,
    };
  }

  if (!isVisualizationSpec(body.spec)) {
    return {
      ok: false,
      message:
        'O servidor respondeu com sucesso, mas sem a especificação do mapa ("spec" ausente).',
      details,
      spec: body.spec,
    };
  }

  return { ok: true, result: body.spec };
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
  const [spec, setSpec] = React.useState<unknown>(null);

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
      setSpec(outcome.spec ?? null);
      setStatus('error');
      return;
    }

    setResult(outcome.result);
    setSpec(outcome.result);
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
    spec,
    handleSubmit,
  };
};
