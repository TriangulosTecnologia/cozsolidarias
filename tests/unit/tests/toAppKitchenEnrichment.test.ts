import { toAppKitchenEnrichment } from 'src/data-gateway/transformers/toAppKitchenEnrichment';
import type { StaticEnrichmentSource } from 'src/data-source-static/types';

const validSource = (): StaticEnrichmentSource => {
  return {
    cozinhaId: 'CS014558',
    generatedAt: '2025-11-04',
    status: {
      situacao: { value: 'Habilitada', source: "Banco — 'Situação'" },
      emFuncionamento: { value: 'Sim', source: 'Banco — func' },
      refeicoesPorDia: { value: 120, source: 'Banco — refeições' },
    },
    sourcing: {
      comoAdquire: {
        value: 'Compra em feiras',
        source: 'Form — aquisição',
        note: 'autodeclarado (2024)',
      },
      gastoMensalTexto: { value: 'Cerca de 5000', source: 'Form — gasto' },
      trabalhadores: { value: '4', source: 'Form — trabalhadores' },
    },
    supplyNetwork: {
      municipio: 'Porto Alegre',
      paaReceivingUnits: { value: 126, source: 'PAA — unidades' },
      isPaaReceiver: { value: false, source: 'PAA — CNPJ' },
      paaProducts: {
        value: [{ produto: 'Arroz', kg: 1200 }],
        source: 'PAA — produtos',
      },
      cafOrganizations: { value: 12, source: 'CAF — contagem' },
      cafExamples: {
        value: ['Cooperativa A', 'Associação B'],
        source: 'CAF — razão social',
      },
    },
  };
};

const ctx = { cozinhaId: 'CS014558' };

describe('toAppKitchenEnrichment', () => {
  test('returns a validated enrichment contract', () => {
    const result = toAppKitchenEnrichment(validSource(), ctx);

    expect(result.cozinhaId).toBe('CS014558');
    expect(result.generatedAt).toBe('2025-11-04');
    expect(result.status.situacao.value).toBe('Habilitada');
    expect(result.status.refeicoesPorDia.value).toBe(120);
    expect(result.sourcing?.comoAdquire.value).toBe('Compra em feiras');
    expect(result.sourcing?.comoAdquire.note).toBe('autodeclarado (2024)');
    expect(result.supplyNetwork.municipio).toBe('Porto Alegre');
    expect(result.supplyNetwork.paaProducts.value).toEqual([
      { produto: 'Arroz', kg: 1200 },
    ]);
    expect(result.supplyNetwork.cafExamples.value).toEqual([
      'Cooperativa A',
      'Associação B',
    ]);
  });

  test('carries null values with their source untouched', () => {
    const source = validSource();
    source.status.refeicoesPorDia = {
      value: null,
      source: 'Banco — refeições',
    };

    const result = toAppKitchenEnrichment(source, ctx);

    expect(result.status.refeicoesPorDia.value).toBeNull();
    expect(result.status.refeicoesPorDia.source).toBe('Banco — refeições');
  });

  test('returns null sourcing when the form did not match', () => {
    const source = validSource();
    source.sourcing = null;

    const result = toAppKitchenEnrichment(source, ctx);

    expect(result.sourcing).toBeNull();
  });

  test('omits note when absent', () => {
    const result = toAppKitchenEnrichment(validSource(), ctx);

    expect(result.status.situacao.note).toBeUndefined();
  });

  test('throws when status or supplyNetwork is missing', () => {
    const source = validSource();
    // @ts-expect-error exercising the runtime guard with a malformed source
    source.status = undefined;

    expect(() => {
      return toAppKitchenEnrichment(source, ctx);
    }).toThrow(/missing status or supplyNetwork/);
  });

  test('throws when município is missing', () => {
    const source = validSource();
    // @ts-expect-error exercising the runtime guard with a malformed source
    source.supplyNetwork.municipio = 42;

    expect(() => {
      return toAppKitchenEnrichment(source, ctx);
    }).toThrow(/missing município/);
  });

  test('throws when a sourced value has no string source', () => {
    const source = validSource();
    // @ts-expect-error exercising the runtime guard with a malformed source
    source.status.situacao = { value: 'x', source: 123 };

    expect(() => {
      return toAppKitchenEnrichment(source, ctx);
    }).toThrow(/malformed sourced value/);
  });

  test('throws on an unexpected value type', () => {
    const source = validSource();
    // @ts-expect-error exercising the runtime guard with a malformed source
    source.status.refeicoesPorDia = { value: 'many', source: 'Banco' };

    expect(() => {
      return toAppKitchenEnrichment(source, ctx);
    }).toThrow(/unexpected value type/);
  });

  test('throws on a malformed PAA product entry', () => {
    const source = validSource();
    // @ts-expect-error exercising the runtime guard with a malformed source
    source.supplyNetwork.paaProducts.value = [
      { produto: 'Arroz', kg: 'muito' },
    ];

    expect(() => {
      return toAppKitchenEnrichment(source, ctx);
    }).toThrow(/unexpected value type/);
  });

  test('throws when the source is not an object', () => {
    expect(() => {
      // @ts-expect-error exercising the runtime guard with a non-object
      return toAppKitchenEnrichment(null, ctx);
    }).toThrow(/not an enrichment object/);
  });
});
