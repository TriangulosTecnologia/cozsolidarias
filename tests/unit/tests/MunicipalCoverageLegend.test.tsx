import '@testing-library/jest-dom';

import { fireEvent, screen } from '@testing-library/react';
import * as React from 'react';

import MunicipalCoverageLegend from '@/app/(features)/mapas/MunicipalCoverageLegend';

import { coverageRisks } from '../fixtures/coverageRisks';
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
const state = {
  active: false,
  setActive: jest.fn(),
  snapshot: enabledShareSnapshot,
  loading: false,
  error: null,
  retry: jest.fn(),
  cadinsan: coverageRisks,
};

test('shows count-weighted evidence and switches between circles and the nine-color synthesis', () => {
  const Parent = () => {
    const [summary, setSummary] = React.useState(false);
    return (
      <MunicipalCoverageLegend
        state={{ ...state, summary, setSummary, scenario: 'sem' }}
      />
    );
  };
  renderWithChakra(<Parent />);
  expect(screen.getByText(/Área do círculo/)).toBeInTheDocument();
  expect(screen.getByText(/cenário sem PBF/)).toBeInTheDocument();
  expect(screen.getByText('2 / 8')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Mostrar síntese bivariada' })
  );
  expect(
    screen.getByRole('img', { name: /Matriz de nove cores/ })
  ).toBeInTheDocument();
  expect(screen.queryByText(/Área do círculo/)).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Mostrar círculos divididos' })
  );
  expect(screen.getByText(/Área do círculo/)).toBeInTheDocument();
});

test('discloses the legend on compact screens and exposes loading and retry', () => {
  mockCompact = true;
  const retry = jest.fn();
  const props = {
    ...state,
    snapshot: null,
    loading: true,
    error: 'Falha',
    retry,
    cadinsan: undefined,
  };
  renderWithChakra(<MunicipalCoverageLegend state={props} />);
  const button = screen.getByRole('button', { name: 'Tm 2025 · legenda' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('Falha');
  expect(
    screen.getByRole('button', { name: 'Mostrar síntese bivariada' })
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(retry).toHaveBeenCalledTimes(1);
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'false');
  mockCompact = false;
});

test('keeps missing risk out of the evidence table and handles an absent optional view setter', () => {
  const { rerender } = renderWithChakra(
    <MunicipalCoverageLegend state={state} />
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Mostrar síntese bivariada' })
  );
  expect(screen.getByText(/cenário com PBF/)).toBeInTheDocument();
  rerender(<MunicipalCoverageLegend state={{ ...state, cadinsan: [] }} />);
  expect(screen.getByText(/CADINSAN ainda indisponível/)).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
});
