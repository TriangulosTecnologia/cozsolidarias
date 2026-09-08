import '@testing-library/jest-dom';

import { fireEvent, screen } from '@testing-library/react';
import type * as React from 'react';
import AiPlayground from 'src/app/(features)/ai/AiPlayground';

import { renderWithChakra } from './renderWithChakra';

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

const jsonResponse = (body: unknown, ok = true) => {
  return {
    ok,
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
          error: 'Prompt inválido: envie um texto entre 1 e 500 caracteres.',
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
      await screen.findByText('Não foi possível gerar o mapa.')
    ).toBeInTheDocument();
  });
});
