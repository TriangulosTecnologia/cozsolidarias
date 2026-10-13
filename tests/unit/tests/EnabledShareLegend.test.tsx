import '@testing-library/jest-dom';

import { fireEvent, screen } from '@testing-library/react';

import EnabledShareLegend from '@/app/(features)/mapas/EnabledShareLegend';
import { renderEnabledShareTooltip } from '@/app/(features)/mapas/renderEnabledShareTooltip';

import { enabledShareSnapshot } from '../fixtures/enabledShare';
import { renderWithChakra } from './renderWithChakra';

let mockCompact = false;
jest.mock('@ttoss/geovis', () => {
  return {
    useCompactViewport: () => {
      return mockCompact;
    },
  };
});
test('shows a percent size key and the real national denominator', () => {
  renderWithChakra(
    <EnabledShareLegend
      snapshot={enabledShareSnapshot}
      loading={false}
      error={null}
      retry={jest.fn()}
    />
  );
  expect(screen.getByText(/÷ 10 cozinhas/)).toBeInTheDocument();
  expect(screen.getByText('20%')).toBeInTheDocument();
  const circles = screen.getByRole('img').querySelectorAll('circle');
  expect(circles).toHaveLength(3);
  expect(
    Number(circles[2].getAttribute('r')) / Number(circles[0].getAttribute('r'))
  ).toBe(2);
});

test('shows loading and an actionable failure instead of an empty numeric legend', () => {
  const retry = jest.fn();
  const { rerender } = renderWithChakra(
    <EnabledShareLegend
      snapshot={null}
      loading={true}
      error={null}
      retry={retry}
    />
  );
  expect(screen.getByRole('status')).toHaveTextContent('Carregando');
  rerender(
    <EnabledShareLegend
      snapshot={null}
      loading={false}
      error="Falhou"
      retry={retry}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
});

test('tooltip reports numerator, denominator and snapshot year', () => {
  const info = {
    featureId: '3550308',
    layerId: 'x',
    sourceId: 'y',
    value: 20,
    point: { x: 0, y: 0 },
  };
  const { rerender } = renderWithChakra(
    <>{renderEnabledShareTooltip({ snapshot: enabledShareSnapshot, info })}</>
  );
  expect(screen.getByText('20% do total nacional')).toBeInTheDocument();
  expect(
    screen.getByText(/2 habilitadas \/ 10 cozinhas no Brasil · 2025/)
  ).toBeInTheDocument();
  rerender(
    <>
      {renderEnabledShareTooltip({
        snapshot: enabledShareSnapshot,
        info: { ...info, featureId: 'missing' },
      })}
    </>
  );
  expect(screen.getByText('Dado indisponível')).toBeInTheDocument();
  rerender(<>{renderEnabledShareTooltip({ snapshot: null, info })}</>);
  expect(screen.getByText('Dado indisponível')).toBeInTheDocument();
});

test('mobile legend stays collapsed until requested', () => {
  mockCompact = true;
  renderWithChakra(
    <EnabledShareLegend
      snapshot={enabledShareSnapshot}
      loading={false}
      error={null}
      retry={jest.fn()}
    />
  );
  const button = screen.getByRole('button', {
    name: 'Habilitadas 2025 · legenda',
  });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'false');
  mockCompact = false;
});
