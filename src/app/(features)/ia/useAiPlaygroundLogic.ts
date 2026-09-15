import type { VisualizationSpec } from '@ttoss/geovis';
import * as React from 'react';

type Status = 'idle' | 'loading' | 'error' | 'success';

type ErrorDetails = {
  issues?: Array<{ code: string; message: string }>;
  spec?: unknown;
};

type SetErrorFn = (error: string, details?: ErrorDetails) => void;

export const useAiPlaygroundLogic = () => {
  const [prompt, setPrompt] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [result, setResult] = React.useState<VisualizationSpec | null>(null);
  const [showJson, setShowJson] = React.useState(false);
  const [errorDetails, setErrorDetails] = React.useState<ErrorDetails | null>(
    null
  );

  const handleError: SetErrorFn = (error, details) => {
    setErrorMessage(error);
    setErrorDetails(details ?? null);
    setStatus('error');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (prompt.trim() === '' || status === 'loading') {
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    setShowJson(false);

    try {
      const response = await fetch('/api/ai/spec', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const body = (await response.json()) as {
        result?: VisualizationSpec;
        error?: string;
        issues?: Array<{ code: string; message: string }>;
        spec?: unknown;
      };

      if (!response.ok || !body.result) {
        const errorMsg = body.error ?? 'Não foi possível gerar o mapa.';
        const details =
          body.issues || body.spec
            ? { issues: body.issues, spec: body.spec }
            : undefined;
        handleError(errorMsg, details);
        return;
      }

      setResult(body.result);
      setErrorDetails(null);
      setStatus('success');
    } catch {
      handleError(
        'Falha de conexão. Verifique sua internet e tente novamente.'
      );
    }
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
