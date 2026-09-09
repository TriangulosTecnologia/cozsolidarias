import {
  buildCozinhaStatusLegend,
  colorForCozinhaStatus,
  cozinhaStatusLabel,
  cozinhaStatusShortLabel,
} from 'src/app/(features)/mapas/geovisCozinhaStatusScales';

describe('cozinhaStatusLabel', () => {
  test('maps each known source-native status text to its descriptive label', () => {
    expect(cozinhaStatusLabel('Sim, está funcionando normalmente')).toBe(
      'Em funcionamento'
    );
    expect(
      cozinhaStatusLabel('Está funcionando com carga horária reduzida')
    ).toBe('Funcionamento reduzido');
    expect(
      cozinhaStatusLabel('Não, a Cozinha encontra-se paralisada, sem atividade')
    ).toBe('Paralisada');
  });

  test('maps unknown or blank text to "Não informado"', () => {
    expect(cozinhaStatusLabel('')).toBe('Não informado');
    expect(cozinhaStatusLabel('qualquer outra coisa')).toBe('Não informado');
  });
});

describe('cozinhaStatusShortLabel', () => {
  test('maps each descriptive label to its terse traffic-light label', () => {
    expect(cozinhaStatusShortLabel('Em funcionamento')).toBe('Ativo');
    expect(cozinhaStatusShortLabel('Funcionamento reduzido')).toBe('Reduzido');
    expect(cozinhaStatusShortLabel('Paralisada')).toBe('Inativo');
  });

  test('maps the unknown class, an unmapped label and null alike', () => {
    expect(cozinhaStatusShortLabel('Não informado')).toBe('Não informado');
    expect(cozinhaStatusShortLabel('qualquer outra coisa')).toBe(
      'Não informado'
    );
    expect(cozinhaStatusShortLabel(null)).toBe('Não informado');
  });
});

describe('colorForCozinhaStatus', () => {
  test('null resolves to the masked fallback', () => {
    expect(colorForCozinhaStatus(null)).toBe(
      colorForCozinhaStatus('Não informado')
    );
  });

  // `null` returns early and every other label asserted here is a real
  // `COZINHA_STATUS_COLORS` key, so this is the only case that reaches the
  // lookup's `??` fallback — a label the mapping has never heard of.
  test('a label outside the mapping resolves to the masked fallback', () => {
    expect(colorForCozinhaStatus('Situação inexistente')).toBe(
      colorForCozinhaStatus(null)
    );
  });

  test('each known status gets a distinct painted color, none equal to the fallback', () => {
    const colors = new Set([
      colorForCozinhaStatus('Em funcionamento'),
      colorForCozinhaStatus('Funcionamento reduzido'),
      colorForCozinhaStatus('Paralisada'),
    ]);
    expect(colors.size).toBe(3);
    expect(colors.has(colorForCozinhaStatus(null))).toBe(false);
  });
});

describe('buildCozinhaStatusLegend', () => {
  test('is positioned only when the pontos mode is active', () => {
    expect(buildCozinhaStatusLegend(true).position).toBe('bottom-right');
    expect(buildCozinhaStatusLegend(false).position).toBeUndefined();
  });

  test('colors categorically by the joined status value', () => {
    const legend = buildCozinhaStatusLegend(true);
    expect(legend.colorBy.type).toBe('categorical');
    expect(legend.colorBy.property).toBe('value');
  });

  test('draws a named swatch for the unknown class', () => {
    const { colorBy } = buildCozinhaStatusLegend(true);
    const mapping =
      colorBy.type === 'categorical' ? colorBy.mapping : undefined;

    // A categorical legend draws one swatch per `mapping` entry, so the
    // blank-status points get named only by being mapped — `defaultColor` alone
    // paints them grey without ever explaining the grey.
    expect(Object.keys(mapping ?? {})).toContain('Não informado');
    expect(mapping?.['Não informado']).toBe(colorForCozinhaStatus(null));
  });
});
