import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import DataDictionary from 'src/app/(features)/dados/_components/DataDictionary';

import { describedDataset, restrictedDataset } from './catalogueFixture';
import { renderWithChakra } from './renderWithChakra';

describe('DataDictionary', () => {
  test('renders one row per field with its role and unit', () => {
    renderWithChakra(
      <DataDictionary
        fields={describedDataset.fields}
        datasetTitle={describedDataset.title}
      />
    );

    expect(screen.getByText('cod_imovel')).toBeInTheDocument();
    expect(screen.getByText('Código do imóvel no CAR.')).toBeInTheDocument();
    expect(screen.getByText('identificador')).toBeInTheDocument();
    expect(screen.getByText('num_area_ha')).toBeInTheDocument();
    expect(screen.getByText('hectare')).toBeInTheDocument();
    // An unstated role or unit renders as an em dash, never blank.
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  test('marks sensitive fields, publishing the column name and not its values', () => {
    renderWithChakra(
      <DataDictionary
        fields={restrictedDataset.fields}
        datasetTitle={restrictedDataset.title}
      />
    );

    expect(screen.getByText('CNPJ')).toBeInTheDocument();
    expect(screen.getByText('dado sensível')).toBeInTheDocument();
  });

  test('captions the table with the dataset it describes', () => {
    renderWithChakra(
      <DataDictionary
        fields={describedDataset.fields}
        datasetTitle="Assentamentos rurais"
      />
    );

    expect(
      screen.getByText('Dicionário de dados de Assentamentos rurais')
    ).toBeInTheDocument();
  });

  test('states explicitly when a dataset has no documented fields', () => {
    renderWithChakra(<DataDictionary fields={[]} datasetTitle="Malhas" />);

    expect(
      screen.getByText(
        'Este dataset ainda não tem o dicionário de campos documentado.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
