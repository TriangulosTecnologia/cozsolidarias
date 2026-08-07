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

  test('maps unknown or blank text to "Outros"', () => {
    expect(cozinhaStatusLabel('')).toBe('Outros');
    expect(cozinhaStatusLabel('qualquer outra coisa')).toBe('Outros');
  });
});

describe('cozinhaStatusShortLabel', () => {
  test('maps each descriptive label to its terse traffic-light label', () => {
    expect(cozinhaStatusShortLabel('Em funcionamento')).toBe('Ativo');
    expect(cozinhaStatusShortLabel('Funcionamento reduzido')).toBe('Reduzido');
    expect(cozinhaStatusShortLabel('Paralisada')).toBe('Inativo');
  });

  test('maps an unknown label or null to "Não informado"', () => {
    expect(cozinhaStatusShortLabel('Outros')).toBe('Não informado');
    expect(cozinhaStatusShortLabel(null)).toBe('Não informado');
  });
});

describe('colorForCozinhaStatus', () => {
  test('null resolves to the masked fallback', () => {
    expect(colorForCozinhaStatus(null)).toBe(colorForCozinhaStatus('Outros'));
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
});
