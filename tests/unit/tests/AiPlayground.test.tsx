import '@testing-library/jest-dom';

import { fireEvent, screen, waitFor } from '@testing-library/react';
import type * as React from 'react';
import AiPlayground from 'src/app/(features)/ia/AiPlayground';

import { renderWithChakra } from './renderWithChakra';

// The worker-URL side effect imports maplibre-gl, which ships ESM only and
// cannot load under jest; it is covered by its own test.
jest.mock('@/components/map/maplibreWorker', () => {
  return {};
});

// `<GeovisWorkspace>` is a closed, ESM-only 3rd-party component (theme-ui +
// MapLibre inside). Stub it so the test can assert what spec it received
// without exercising the real map runtime, which jsdom can't render.
jest.mock('@ttoss/geovis-workspace', () => {
  return {
    __esModule: true,
    GeovisWorkspace: ({
      visualizationSpec,
    }: {
      visualizationSpec: { title?: string };
    }) => {
      return (
        <div data-testid="geovis-workspace">{visualizationSpec.title}</div>
      );
    },
  };
});

// The theme/i18n providers are ESM-only and irrelevant to the logic under test.
jest.mock('@ttoss/react-i18n', () => {
  return {
    __esModule: true,
    I18nProvider: ({ children }: { children: React.ReactNode }) => {
      return <>{children}</>;
    },
  };
});
jest.mock('@ttoss/theme/Bruttal', () => {
  return { __esModule: true, BruttalTheme: { config: {} } };
});
jest.mock('theme-ui', () => {
  return {
    __esModule: true,
    ThemeUIProvider: ({ children }: { children: React.ReactNode }) => {
      return <>{children}</>;
    },
  };
});

const jsonResponse = (
  body: unknown,
  ok = true,
  headers: Record<string, string> = {}
) => {
  return {
    ok,
    headers: new Headers(headers),
    json: () => {
      return Promise.resolve(body);
    },
  } as Response;
};

describe('AiPlayground', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('disables submit until a prompt is typed', () => {
    renderWithChakra(<AiPlayground />);

    expect(screen.getByRole('button', { name: 'Gerar mapa' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'pessoas atendidas por município' },
    });

    expect(screen.getByRole('button', { name: 'Gerar mapa' })).toBeEnabled();
  });

  test('shows the server error message when the request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          error: true,
          message: 'Prompt inválido: envie um texto entre 1 e 500 caracteres.',
        },
        false
      )
    );

    renderWithChakra(<AiPlayground />);

    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar mapa' }));

    expect(
      await screen.findByText(
        'Prompt inválido: envie um texto entre 1 e 500 caracteres.'
      )
    ).toBeInTheDocument();
  });

  test('shows a connection error message when the request throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    renderWithChakra(<AiPlayground />);

    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'pessoas atendidas por município' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar mapa' }));

    expect(
      await screen.findByText(
        'Falha de conexão. Verifique sua internet e tente novamente.'
      )
    ).toBeInTheDocument();
  });

  test('falls back to a default message when the server sends no error text', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false));

    renderWithChakra(<AiPlayground />);

    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'pessoas atendidas por município' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar mapa' }));

    expect(
      await screen.findByText('Não foi possível gerar o mapa')
    ).toBeInTheDocument();
  });

  test('shows an unexpected-content message when the response body is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => {
        return Promise.reject(new Error('not json'));
      },
    } as unknown as Response);

    renderWithChakra(<AiPlayground />);

    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'pessoas atendidas por município' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar mapa' }));

    expect(
      await screen.findByText(
        'O servidor respondeu com um conteúdo inesperado (status 200). Tente novamente.'
      )
    ).toBeInTheDocument();
  });

  test('falls back to a default message when a successful response carries no spec', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ error: false }));

    renderWithChakra(<AiPlayground />);

    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'pessoas atendidas por município' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar mapa' }));

    expect(
      await screen.findByText(
        'O servidor respondeu com sucesso, mas sem a especificação do mapa ("spec" ausente).'
      )
    ).toBeInTheDocument();
  });

  test('renders the spec JSON on a successful submission after clicking "Ver JSON"', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        spec: { title: 'Mapa de IVS por município', layers: [] },
        error: false,
      })
    );

    const { container } = renderWithChakra(<AiPlayground />);

    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'IVS por município' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar mapa' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Ver JSON' })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ver JSON' }));

    await waitFor(() => {
      expect(container.textContent).toContain('Mapa de IVS por município');
    });
  });

  test('lists the issues and still offers the rejected spec behind the JSON toggle', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          error: true,
          message: 'Especificação inválida',
          spec: { title: 'Spec rejeitada', layers: [] },
          issues: [
            { code: 'INVALID_DATA_TYPE', message: 'Data type mismatch' },
          ],
        },
        false
      )
    );

    const { container } = renderWithChakra(<AiPlayground />);

    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'choropleth inválido' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar mapa' }));

    expect(await screen.findByText('Data type mismatch')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Spec rejeitada');

    fireEvent.click(screen.getByRole('button', { name: 'Ver JSON' }));

    await waitFor(() => {
      expect(container.textContent).toContain('Spec rejeitada');
    });
    expect(screen.queryByTestId('geovis-workspace')).not.toBeInTheDocument();
  });

  test('offers no JSON toggle when a failure carries no spec', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: true, message: 'Dataset indisponível' }, false)
      );

    renderWithChakra(<AiPlayground />);

    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'áreas CAF' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar mapa' }));

    expect(await screen.findByText('Dataset indisponível')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ver JSON' })
    ).not.toBeInTheDocument();
  });

  test('does nothing when the form is submitted with a blank prompt', () => {
    global.fetch = jest.fn();

    const { container } = renderWithChakra(<AiPlayground />);
    // Direct form submit bypasses the disabled submit button, exercising the
    // handler's own blank-prompt guard.
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('ignores a duplicate submit while a request is already loading', async () => {
    let resolveFetch: (response: Response) => void = () => {
      return undefined;
    };
    global.fetch = jest.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { container } = renderWithChakra(<AiPlayground />);
    fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
      target: { value: 'pessoas atendidas por município' },
    });

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    // Bypasses the disabled submit button, exercising the handler's own
    // in-flight guard rather than the DOM's `disabled` attribute.
    fireEvent.submit(form);

    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse({ spec: { layers: [] }, error: false }));
    await screen.findByRole('button', { name: 'Gerar mapa' });
  });

  describe('choices', () => {
    const MAP_TYPES = [
      { value: 'choropleth', label: 'Coroplético' },
      { value: 'dotDensity', label: 'Densidade de pontos' },
      { value: 'proportionalCircles', label: 'Círculos proporcionais' },
    ];
    const PROMPT = 'pessoas atendidas por município';

    const submit = () => {
      fireEvent.change(screen.getByLabelText('O que você quer ver?'), {
        target: { value: PROMPT },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Gerar mapa' }));
    };

    const sentBody = (call: number): unknown => {
      const init = jest.mocked(global.fetch).mock.calls[call][1] as RequestInit;
      return JSON.parse(String(init.body));
    };

    test('asks the question and resubmits the prompt with the chosen map type', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            error: false,
            mapTypeOptions: MAP_TYPES,
            clarify: {
              facet: 'mapType',
              question: 'Qual tipo de mapa você prefere?',
              options: [MAP_TYPES[2], MAP_TYPES[1]],
              default: 'proportionalCircles',
            },
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({ error: false, spec: { layers: [] } })
        );

      renderWithChakra(<AiPlayground />);
      submit();

      expect(
        await screen.findByText('Qual tipo de mapa você prefere?')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Círculos proporcionais (sugerido)')
      ).toBeVisible();

      fireEvent.click(
        screen.getByRole('button', { name: 'Densidade de pontos' })
      );

      await screen.findByRole('button', { name: 'Ver JSON' });
      expect(sentBody(1)).toEqual({ prompt: PROMPT, mapType: 'dotDensity' });
    });

    test('sends a chosen dataset as datasetId', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            error: false,
            mapTypeOptions: MAP_TYPES,
            clarify: {
              facet: 'dataset',
              question: 'Qual destes indicadores?',
              options: [
                {
                  value: 'municipios_ivs_renda_trabalho',
                  label: 'IVS – Renda',
                },
              ],
              default: 'municipios_ivs_renda_trabalho',
            },
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({ error: false, spec: { layers: [] } })
        );

      renderWithChakra(<AiPlayground />);
      submit();
      fireEvent.click(
        await screen.findByRole('button', { name: /IVS – Renda/ })
      );

      await screen.findByRole('button', { name: 'Ver JSON' });
      expect(sentBody(1)).toEqual({
        prompt: PROMPT,
        datasetId: 'municipios_ivs_renda_trabalho',
      });
    });

    test('explains what to fix and continues the session with another map type', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              error: true,
              message: 'Spec inválida',
              issues: [{ code: 'missing-legend', message: 'Falta legenda' }],
              requirements: [
                {
                  code: 'missing-legend',
                  message: 'Falta legenda',
                  fix: 'Peça que o mapa tenha legenda.',
                },
              ],
              mapTypeOptions: MAP_TYPES,
            },
            false,
            { 'x-session-id': 'sess_abc12345' }
          )
        )
        .mockResolvedValueOnce(
          jsonResponse({ error: false, spec: { layers: [] } })
        );

      renderWithChakra(<AiPlayground />);
      submit();

      expect(
        await screen.findByText('Peça que o mapa tenha legenda.')
      ).toBeInTheDocument();
      expect(screen.queryByText('Falta legenda')).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: 'Densidade de pontos' })
      );

      await screen.findByRole('button', { name: 'Ver JSON' });
      expect(sentBody(1)).toEqual({
        prompt: PROMPT,
        mapType: 'dotDensity',
        sessionId: 'sess_abc12345',
      });
    });

    test('keeps earlier answers when a second question follows the first', async () => {
      const ask = (facet: string, option: { value: string; label: string }) => {
        return jsonResponse({
          error: false,
          mapTypeOptions: MAP_TYPES,
          clarify: {
            facet,
            question: `Pergunta ${facet}`,
            options: [option],
            default: option.value,
          },
        });
      };
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          ask('dataset', {
            value: 'cozinhas_pessoas_atendidas',
            label: 'Pessoas',
          })
        )
        .mockResolvedValueOnce(
          ask('mapType', { value: 'dotDensity', label: 'Pontos' })
        )
        .mockResolvedValueOnce(
          jsonResponse({ error: false, spec: { layers: [] } })
        );

      renderWithChakra(<AiPlayground />);
      submit();
      fireEvent.click(await screen.findByRole('button', { name: /Pessoas/ }));
      fireEvent.click(await screen.findByRole('button', { name: /Pontos/ }));

      await screen.findByRole('button', { name: 'Ver JSON' });
      expect(sentBody(2)).toEqual({
        prompt: PROMPT,
        datasetId: 'cozinhas_pessoas_atendidas',
        mapType: 'dotDensity',
      });
    });

    test('keeps offering the map types after a success', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          error: false,
          spec: { layers: [] },
          mapTypeOptions: MAP_TYPES,
        })
      );

      renderWithChakra(<AiPlayground />);
      submit();

      expect(
        await screen.findByRole('button', { name: 'Círculos proporcionais' })
      ).toBeInTheDocument();
    });
  });
});
