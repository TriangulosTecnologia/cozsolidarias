import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import type {
  AssentamentoAtributo,
  MapMode,
} from 'src/app/(features)/mapas/geovisSpec';
import {
  renderAssentamentoTooltip,
  renderCozinhaTooltip,
  renderMunicipioTooltip,
} from 'src/app/(features)/mapas/mapaTooltips';
import type {
  cadinsanByCity,
  cafByCity,
  kitchenRateByCity,
} from 'src/data-gateway/schema';

import { renderWithChakra } from './renderWithChakra';

const REGISTER: kitchenRateByCity = {
  codigoIbge: '3550308',
  municipio: 'São Paulo',
  quantidade: 5,
  pessoasAtendidas: 1_000,
  populacao: 11_451_999,
  porCemMil: 0.04,
  percentualDoBrasil: 12.5,
  pessoasCadUnico: 3_884_884,
  porDezMilCadUnico: 0.01,
  pessoasPorCozinha: 776_977,
};

/** Altamira/PA — a município where the Bolsa Família effect is large. */
const CADINSAN_REGISTER: cadinsanByCity = {
  codigoIbge: '1500602',
  municipio: 'Altamira',
  uf: 'Pará',
  regiao: 'Norte',
  absolutoComPbf: 2616,
  absolutoSemPbf: 5779,
  cadastrosCadunico: 14656,
  proporcaoComPbf: 17.85,
  proporcaoSemPbf: 39.43,
};

/** Renders a tooltip for the given mode/register into the DOM under Chakra. */
const renderTooltip = (args: {
  mode: MapMode;
  register?: kitchenRateByCity;
  cafRegister?: cafByCity;
  cadinsanRegister?: cadinsanByCity;
  value?: number | null;
}) => {
  return renderWithChakra(
    <>
      {renderMunicipioTooltip({
        mode: args.mode,
        name: 'São Paulo',
        register: args.register,
        cafRegister: args.cafRegister,
        cadinsanRegister: args.cadinsanRegister,
        value: args.value ?? null,
      })}
    </>
  );
};

describe('renderMunicipioTooltip', () => {
  test('count mode shows the painted feature-state value over the joined count', () => {
    renderTooltip({ mode: 'coropletico', register: REGISTER, value: 7 });

    expect(screen.getByText('São Paulo')).toBeInTheDocument();
    expect(screen.getByText('7 cozinhas')).toBeInTheDocument();
  });

  test('count mode uses the singular "cozinha" for a count of one', () => {
    renderTooltip({ mode: 'coropletico', register: REGISTER, value: 1 });

    expect(screen.getByText('1 cozinha')).toBeInTheDocument();
  });

  test('count mode falls back to the joined count when there is no feature-state value', () => {
    renderTooltip({ mode: 'coropletico', register: REGISTER, value: null });

    expect(screen.getByText('5 cozinhas')).toBeInTheDocument();
  });

  test('count mode reads "sem cozinha" for a zero count', () => {
    renderTooltip({ mode: 'coropletico', register: undefined, value: 0 });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
  });

  test('choropleth count mode keeps the faixa colour swatch', () => {
    renderTooltip({ mode: 'coropletico', register: REGISTER, value: 5 });

    // The count row carries the swatch Box alongside the label.
    expect(screen.getByText('5 cozinhas').parentElement?.children).toHaveLength(
      2
    );
  });

  test.each(['pontos', 'circulos'] as const)(
    '%s mode shows only the name and count, without the colour swatch',
    (mode) => {
      renderTooltip({ mode, register: REGISTER, value: 5 });

      expect(screen.getByText('São Paulo')).toBeInTheDocument();
      expect(screen.getByText('5 cozinhas')).toBeInTheDocument();
      // No swatch: the count row holds only the label.
      expect(
        screen.getByText('5 cozinhas').parentElement?.children
      ).toHaveLength(1);
    }
  );

  test('rate mode shows the per-100k rate and the auxiliary population line', () => {
    renderTooltip({ mode: 'coropletico-taxa', register: REGISTER });

    expect(screen.getByText(/por 100 mil hab\./)).toBeInTheDocument();
    // Auxiliary line (only the secondary line carries the "cozinhas ·" prefix).
    expect(screen.getByText(/cozinhas ·.*hab\./)).toBeInTheDocument();
  });

  test('rate mode reads "sem cozinha" and drops the auxiliary line without data', () => {
    renderTooltip({ mode: 'coropletico-taxa', register: undefined });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
    expect(screen.queryByText(/cozinhas ·/)).not.toBeInTheDocument();
  });

  test('share mode shows the % of Brazil', () => {
    renderTooltip({ mode: 'coropletico-percentual', register: REGISTER });

    expect(screen.getByText(/% das cozinhas do Brasil/)).toBeInTheDocument();
  });

  test('share mode reads "sem cozinha" for a zero share', () => {
    renderTooltip({ mode: 'coropletico-percentual', register: undefined });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
  });

  test('CAF share mode shows the % of Brazil (4 decimals) and the CAF count', () => {
    renderTooltip({
      mode: 'coropletico-cafs-percentual',
      cafRegister: {
        codigoIbge: '3550308',
        municipio: 'São Paulo',
        quantidade: 1234,
        percentualDoBrasil: 0.0084,
      },
    });

    expect(screen.getByText('0,0084% dos CAFs do Brasil')).toBeInTheDocument();
    expect(screen.getByText('1.234 CAFs')).toBeInTheDocument();
  });

  test('CAF share mode uses the singular "CAF" for a count of one', () => {
    renderTooltip({
      mode: 'coropletico-cafs-percentual',
      cafRegister: {
        codigoIbge: '3550308',
        municipio: 'São Paulo',
        quantidade: 1,
        percentualDoBrasil: 0.0001,
      },
    });

    expect(screen.getByText('1 CAF')).toBeInTheDocument();
  });

  test('CAF share mode reads "sem CAF" without a CAF register', () => {
    renderTooltip({
      mode: 'coropletico-cafs-percentual',
      cafRegister: undefined,
    });

    expect(screen.getByText('Sem CAF registrado')).toBeInTheDocument();
  });

  test('CADINSAN "sem PBF" mode shows the share, the N de M line and the relief effect', () => {
    renderTooltip({
      mode: 'coropletico-cadinsan-sem-pbf',
      cadinsanRegister: CADINSAN_REGISTER,
    });

    expect(
      screen.getByText('39,4% em insegurança alimentar (sem o Bolsa Família)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('5.779 de 14.656 famílias do CadÚnico neste cenário')
    ).toBeInTheDocument();
    // Effect line points to the com-PBF scenario ("cai para").
    expect(
      screen.getByText('Com o Bolsa Família, cai para 17,9% (2.616 famílias)')
    ).toBeInTheDocument();
  });

  test('CADINSAN "com PBF" mode shows the counterfactual effect ("seria")', () => {
    renderTooltip({
      mode: 'coropletico-cadinsan-com-pbf',
      cadinsanRegister: CADINSAN_REGISTER,
    });

    expect(
      screen.getByText('17,9% em insegurança alimentar (com o Bolsa Família)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Sem o Bolsa Família, seria 39,4% (5.779 famílias)')
    ).toBeInTheDocument();
  });

  test('CADINSAN mode reads "sem dado" without a CADINSAN register', () => {
    renderTooltip({
      mode: 'coropletico-cadinsan-sem-pbf',
      cadinsanRegister: undefined,
    });

    expect(screen.getByText('Sem dado do CadÚnico')).toBeInTheDocument();
  });

  test('CADINSAN mode reads "sem dado" when the município has no CadÚnico denominator', () => {
    renderTooltip({
      mode: 'coropletico-cadinsan-com-pbf',
      cadinsanRegister: {
        codigoIbge: '9999999',
        municipio: 'Sem CadÚnico',
        uf: 'X',
        regiao: 'Sul',
        absolutoComPbf: 0,
        absolutoSemPbf: 0,
        cadastrosCadunico: 0,
        proporcaoComPbf: null,
        proporcaoSemPbf: null,
      },
    });

    expect(screen.getByText('Sem dado do CadÚnico')).toBeInTheDocument();
  });

  test('CADINSAN mode omits the effect line when the counterpart scenario has no share', () => {
    renderTooltip({
      mode: 'coropletico-cadinsan-com-pbf',
      cadinsanRegister: {
        ...CADINSAN_REGISTER,
        proporcaoSemPbf: null,
        absolutoSemPbf: 0,
      },
    });

    // The active (com-PBF) scenario still shows; the "seria" effect is dropped.
    expect(
      screen.getByText(/17,9% em insegurança alimentar/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Sem o Bolsa Família, seria/)
    ).not.toBeInTheDocument();
  });

  test('CadÚnico mode shows the per-10k-CadÚnico rate', () => {
    renderTooltip({ mode: 'coropletico-cadunico', register: REGISTER });

    expect(screen.getByText(/por 10 mil no CadÚnico/)).toBeInTheDocument();
    // Auxiliary line (only the secondary line carries the "cozinhas ·" prefix).
    expect(screen.getByText(/cozinhas ·.*no CadÚnico/)).toBeInTheDocument();
  });

  test('CadÚnico mode reads "sem cozinha" without data', () => {
    renderTooltip({ mode: 'coropletico-cadunico', register: undefined });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
  });

  test('coverage mode shows the people-per-cozinha value', () => {
    renderTooltip({ mode: 'coropletico-pessoas-cozinha', register: REGISTER });

    expect(screen.getByText(/pessoas por cozinha/)).toBeInTheDocument();
  });

  test('coverage mode reads "sem cozinha" without data', () => {
    renderTooltip({ mode: 'coropletico-pessoas-cozinha', register: undefined });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
  });

  test('IVS mode shows the score and its faixa', () => {
    renderTooltip({ mode: 'coropletico-ivs', value: 0.15 });

    expect(screen.getByText(/IVS 0,150 · Muito baixa/)).toBeInTheDocument();
  });

  test.each([
    {
      mode: 'coropletico-ivs-infraestrutura' as const,
      label: 'Infraestrutura urbana',
    },
    {
      mode: 'coropletico-ivs-capital-humano' as const,
      label: 'Capital humano',
    },
    {
      mode: 'coropletico-ivs-renda-trabalho' as const,
      label: 'Renda e trabalho',
    },
  ])('$mode labels the sub-index and its faixa', ({ mode, label }) => {
    renderTooltip({ mode, value: 0.6 });

    expect(
      screen.getByText(new RegExp(`${label} 0,600 · Muito alta`))
    ).toBeInTheDocument();
  });

  test('IVS-family mode reads "sem dado" without a joined value', () => {
    renderTooltip({ mode: 'coropletico-ivs-capital-humano', value: null });

    expect(screen.getByText('Sem dado de Capital humano')).toBeInTheDocument();
  });

  test('IDHM mode shows the score and its (inverse) faixa', () => {
    renderTooltip({ mode: 'coropletico-idhm', value: 0.75 });

    expect(screen.getByText(/IDHM 0,750 · Alto/)).toBeInTheDocument();
  });

  test.each([
    {
      mode: 'coropletico-idhm-longevidade' as const,
      label: 'IDHM Longevidade',
    },
    {
      mode: 'coropletico-idhm-educacao' as const,
      label: 'IDHM Educação',
    },
    {
      mode: 'coropletico-idhm-renda' as const,
      label: 'IDHM Renda',
    },
    {
      mode: 'coropletico-idhm-educacao-escolaridade' as const,
      label: 'IDHM Escolaridade',
    },
    {
      mode: 'coropletico-idhm-educacao-frequencia' as const,
      label: 'IDHM Frequência escolar',
    },
  ])('$mode labels the IDHM dimension and its faixa', ({ mode, label }) => {
    renderTooltip({ mode, value: 0.45 });

    expect(
      screen.getByText(new RegExp(`${label} 0,450 · Muito baixo`))
    ).toBeInTheDocument();
  });

  test('IDHM mode reads "sem dado" without a joined value', () => {
    renderTooltip({ mode: 'coropletico-idhm-renda', value: null });

    expect(screen.getByText('Sem dado de IDHM Renda')).toBeInTheDocument();
  });
});

describe('renderCozinhaTooltip', () => {
  test('shows the caption, the kitchen name and the terse status label', () => {
    renderWithChakra(
      <>
        {renderCozinhaTooltip({
          nome: 'Cozinha Esperança',
          statusLabel: 'Em funcionamento',
        })}
      </>
    );

    expect(screen.getByText('Nome da cozinha')).toBeInTheDocument();
    expect(screen.getByText('Cozinha Esperança')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  test('reads "Não informado" when the status is unknown', () => {
    renderWithChakra(
      <>{renderCozinhaTooltip({ nome: 'Sem status', statusLabel: null })}</>
    );

    expect(screen.getByText('Não informado')).toBeInTheDocument();
  });
});

const ATRIBUTO: AssentamentoAtributo = {
  codImovel: 'SP-1-AAA',
  municipio: 'Alpha',
  uf: 'SP',
  areaHa: 274.3,
  modulosFiscais: 1.5,
  status: 'AT',
  condicao: 'Aguardando analise',
  dtCriacao: '01/01/2020',
  dtAtualizacao: '02/02/2021',
};

describe('renderAssentamentoTooltip', () => {
  test('titles with cod_imovel and lists status + settlement details', () => {
    renderWithChakra(
      <>{renderAssentamentoTooltip({ atributo: ATRIBUTO, value: 'Ativo' })}</>
    );

    // The raw base has no settlement name, so the code is the title.
    expect(screen.getByText('SP-1-AAA')).toBeInTheDocument();
    expect(screen.getByText('Situação: Ativo')).toBeInTheDocument();
    expect(screen.getByText('Alpha — SP')).toBeInTheDocument();
    expect(
      screen.getByText(/274,3 ha · 1,5 módulos fiscais/)
    ).toBeInTheDocument();
    expect(
      screen.getByText('Condição: Aguardando analise')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Criado em 01\/01\/2020 · atualizado em 02\/02\/2021/)
    ).toBeInTheDocument();
  });

  test('derives the status label from the attribute when no feature-state value', () => {
    renderWithChakra(
      <>{renderAssentamentoTooltip({ atributo: ATRIBUTO, value: null })}</>
    );

    expect(screen.getByText('Situação: Ativo')).toBeInTheDocument();
  });

  test('falls back to a generic name and unknown status without an attribute', () => {
    renderWithChakra(
      <>{renderAssentamentoTooltip({ atributo: undefined, value: null })}</>
    );

    expect(screen.getByText('Assentamento')).toBeInTheDocument();
    expect(screen.getByText('Situação desconhecida')).toBeInTheDocument();
  });
});
