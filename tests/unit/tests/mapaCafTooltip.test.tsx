import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import { renderCafTooltip } from 'src/app/(features)/mapas/mapaCafTooltip';
import type { CafAreaProperties } from 'src/data-gateway/schema';

import { renderWithChakra } from './renderWithChakra';

const PROPS: CafAreaProperties = {
  nrCaf: '6',
  dsTipoArea: 'Terra',
  dsTipoUnidadeMedida: 'ha',
  nrArea: 2.2,
  nmMunicipio: 'Brasília',
  sgUf: 'DF',
  dsTipoLocalizacaoArea: 'Rural',
  dsCondicaoDominio: 'Proprietário',
  stImovelPrincipal: 'true',
};

describe('renderCafTooltip', () => {
  test('shows the CAF id, area in hectares and location/domain details', () => {
    renderWithChakra(<>{renderCafTooltip(PROPS)}</>);

    expect(screen.getByText('CAF 6')).toBeInTheDocument();
    expect(screen.getByText('2,2 hectares de terra')).toBeInTheDocument();
    expect(screen.getByText('Rural · Proprietário')).toBeInTheDocument();
  });

  test('renders the "Imóvel principal" badge when it is the main property', () => {
    renderWithChakra(<>{renderCafTooltip(PROPS)}</>);

    expect(screen.getByText('Imóvel principal')).toBeInTheDocument();
  });

  test('omits the badge and keeps the raw unit when not the main property', () => {
    renderWithChakra(
      <>
        {renderCafTooltip({
          ...PROPS,
          stImovelPrincipal: 'false',
          dsTipoUnidadeMedida: 'm²',
        })}
      </>
    );

    expect(screen.queryByText('Imóvel principal')).not.toBeInTheDocument();
    expect(screen.getByText('2,2 m² de terra')).toBeInTheDocument();
  });
});
