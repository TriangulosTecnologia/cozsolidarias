import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import { CozinhaDetailPanel } from 'src/app/(features)/mapas/CozinhaDetailPanel';
import type { CozinhaDetalhe } from 'src/data-gateway/schema';

const detalhe: CozinhaDetalhe = {
  codigo: 'CS016282',
  nome: 'Cozinha Esperança',
  endereco: 'Rua das Flores, 10',
  bairro: 'Centro',
  cep: '01001000',
  municipio: 'São Paulo',
  uf: 'SP',
  emFuncionamento: 'Sim',
  diasFuncionamento: 'Segunda a sexta',
  situacao: 'Habilitada',
  publicoAtendido: 'Moradores de rua',
  publicoTotalAtendido: '350',
  latitude: -23.55,
  longitude: -46.63,
};

describe('CozinhaDetailPanel', () => {
  test('renders name, operating info, full location and people served when present', () => {
    render(<CozinhaDetailPanel cozinha={detalhe} />);

    expect(screen.getByText('Cozinha Esperança')).toBeInTheDocument();
    expect(screen.getByText('Dias de funcionamento')).toBeInTheDocument();
    expect(screen.getByText('Segunda a sexta')).toBeInTheDocument();
    expect(screen.getByText('Rua das Flores, 10')).toBeInTheDocument();
    expect(
      screen.getByText('Centro · São Paulo/SP · CEP 01001000')
    ).toBeInTheDocument();
    expect(screen.getByText('Moradores de rua')).toBeInTheDocument();
    expect(screen.getByText('350 pessoas')).toBeInTheDocument();
    expect(screen.getByText('CS016282')).toBeInTheDocument();
  });

  test('omits the optional rows when the source leaves them blank', () => {
    render(
      <CozinhaDetailPanel
        cozinha={{
          ...detalhe,
          bairro: '',
          cep: '',
          diasFuncionamento: '',
          emFuncionamento: '',
          publicoTotalAtendido: '',
        }}
      />
    );

    expect(screen.queryByText('Dias de funcionamento')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/pessoas$/)).not.toBeInTheDocument();
    expect(screen.getByText('Público atendido')).toBeInTheDocument();
    expect(screen.getByText('São Paulo/SP')).toBeInTheDocument();
  });

  test('hides the public-served block when the source has no public group', () => {
    render(
      <CozinhaDetailPanel cozinha={{ ...detalhe, publicoAtendido: '' }} />
    );

    expect(screen.queryByText('Público atendido')).not.toBeInTheDocument();
  });
});
