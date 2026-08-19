import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import DatasetDetail from 'src/app/(features)/dados/_components/DatasetDetail';

import {
  describedDataset,
  referenceDataset,
  restrictedDataset,
} from './catalogueFixture';
import { renderWithChakra } from './renderWithChakra';

describe('DatasetDetail', () => {
  test('renders a fully described dataset with both coverage dimensions', () => {
    renderWithChakra(<DatasetDetail dataset={describedDataset} />);

    expect(
      screen.getByText('Perímetros dos assentamentos rurais cadastrados.')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Serviço Florestal Brasileiro')
    ).toBeInTheDocument();
    expect(screen.getByText('Público')).toBeInTheDocument();
    expect(screen.getByText('1.825 feições')).toBeInTheDocument();
    expect(screen.getByText('12,0 MB')).toBeInTheDocument();
    expect(
      screen.getByText('Extraído das bases estaduais AREA_IMOVEL.')
    ).toBeInTheDocument();

    expect(screen.getByText('01/06/2026 a 30/06/2026')).toBeInTheDocument();
    expect(screen.getByText('por mês (P1M)')).toBeInTheDocument();
    expect(screen.getByText('irregular')).toBeInTheDocument();
    expect(screen.getByText('retrato de um momento')).toBeInTheDocument();

    expect(screen.getByText('São Paulo, Minas Gerais')).toBeInTheDocument();
    expect(
      screen.getByText('assentamento · cobertura exaustiva')
    ).toBeInTheDocument();
    expect(screen.getByText('polígonos')).toBeInTheDocument();
    expect(screen.getByText('não se aplica · EPSG:4326')).toBeInTheDocument();

    expect(
      screen.getByText('Dicionário de dados · 2 campos')
    ).toBeInTheDocument();
    expect(screen.getByText('cod_imovel')).toBeInTheDocument();

    expect(screen.getByText('Fonte · SICAR')).toBeInTheDocument();
    expect(
      screen.getByText('Base geográfica do Cadastro Ambiental Rural.')
    ).toBeInTheDocument();
    expect(screen.getByText('assentamentos')).toBeInTheDocument();
  });

  test('shows the personal-data notice and the gaps of a restricted dataset', () => {
    renderWithChakra(<DatasetDetail dataset={restrictedDataset} />);

    expect(screen.getByText('Restrito')).toBeInTheDocument();
    expect(screen.getByText('Contém dados pessoais')).toBeInTheDocument();
    expect(
      screen.getByText('Publicar apenas de forma agregada.')
    ).toBeInTheDocument();
    expect(screen.getByText('não documentado')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Cobertura temporal não documentada · Precisão das coordenadas não documentada'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('dado sensível')).toBeInTheDocument();
  });

  test('renders both non-applicable dimensions and omits absent optional rows', () => {
    renderWithChakra(<DatasetDetail dataset={referenceDataset} />);

    expect(
      screen.getByText('não se aplica — dado de referência atemporal')
    ).toBeInTheDocument();
    expect(screen.getByText('não se aplica')).toBeInTheDocument();
    expect(screen.getByText('5.564 entradas')).toBeInTheDocument();
    // No origin notes and no recorded size: those rows must not appear.
    expect(screen.queryByText('Origem')).toBeNull();
    expect(screen.queryByText('Tamanho')).toBeNull();
    expect(
      screen.getByText(
        'Este dataset ainda não tem o dicionário de campos documentado.'
      )
    ).toBeInTheDocument();
  });

  test('warns about restricted access without a note, and hides an unrecorded volume', () => {
    renderWithChakra(
      <DatasetDetail
        dataset={{
          ...describedDataset,
          access: {
            level: 'restricted',
            containsPersonalData: false,
            notes: null,
          },
          volume: null,
        }}
      />
    );

    expect(screen.getByText('Acesso restrito')).toBeInTheDocument();
    expect(
      screen.getByText('Este dataset não é publicado de forma individualizada.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Volume')).toBeNull();
  });

  test('renders multiple temporal intervals and an unmapped spatial grain code', () => {
    renderWithChakra(
      <DatasetDetail
        dataset={{
          ...describedDataset,
          temporal: {
            status: 'described',
            extent: [
              { start: '2010-01-01', end: '2010-12-31' },
              { start: '2022-01-01', end: null },
            ],
            grain: 'P1Y',
            frequency: 'annual',
            history: 'revised',
          },
          spatial: {
            status: 'described',
            extent: [{ scheme: 'iso3166-1', code: 'BR' }],
            coverage: 'sample',
            grain: { code: 'quilombo', label: null },
            geometry: 'none',
            precision: 'notApplicable',
            srid: null,
          },
        }}
      />
    );

    expect(screen.getByText('2010, desde 01/01/2022')).toBeInTheDocument();
    expect(
      screen.getByText('períodos anteriores podem ser revisados')
    ).toBeInTheDocument();
    expect(
      screen.getByText('quilombo · cobertura amostra')
    ).toBeInTheDocument();
    expect(screen.getByText('sem geometria')).toBeInTheDocument();
    // Geometry-less data gets no precision row.
    expect(screen.queryByText('Precisão')).toBeNull();
  });

  test('renders an undocumented spatial dimension', () => {
    renderWithChakra(
      <DatasetDetail
        dataset={{ ...describedDataset, spatial: { status: 'unknown' } }}
      />
    );

    expect(screen.getByText('Território')).toBeInTheDocument();
    expect(screen.getByText('não documentado')).toBeInTheDocument();
  });
});
