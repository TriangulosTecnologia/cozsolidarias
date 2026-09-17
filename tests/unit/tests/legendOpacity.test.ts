import type { LegendSpec } from '@ttoss/geovis';
import { applyLegendOpacity } from 'src/app/(features)/mapas/legendOpacity';

const quantitative: LegendSpec = {
  id: 'cozinhas',
  title: 'Cozinhas',
  colorBy: {
    type: 'quantitative',
    property: 'value',
    scale: 'threshold',
    thresholds: [1, 3],
    colors: ['#C6DBEF', '#6BAED6', '#08306B'],
    defaultColor: '#EEE6DA',
  },
};

const categorical: LegendSpec = {
  id: 'status',
  title: 'Situação',
  colorBy: {
    type: 'categorical',
    property: 'value',
    mapping: { Ativo: '#337C59' },
  },
};

const colorsOf = (legend: LegendSpec) => {
  const colorBy = legend.colorBy as { colors?: string[] } | undefined;
  return colorBy?.colors;
};

const defaultColorOf = (legend: LegendSpec) => {
  const colorBy = legend.colorBy as { defaultColor?: string } | undefined;
  return colorBy?.defaultColor;
};

describe('applyLegendOpacity', () => {
  test('carries the alpha into every band', () => {
    const [legend] = applyLegendOpacity({
      legends: [quantitative],
      fillOpacity: 0.6,
    });

    expect(colorsOf(legend)).toEqual([
      'rgba(198, 219, 239, 0.6)',
      'rgba(107, 174, 214, 0.6)',
      'rgba(8, 48, 107, 0.6)',
    ]);
  });

  /*
   * "Sem dado" is as much a painted cell as any other. Left opaque it would be
   * the most solid thing on a faded map — the one class the reader is meant to
   * look past.
   */
  test('carries it into the no-data colour too', () => {
    const [legend] = applyLegendOpacity({
      legends: [quantitative],
      fillOpacity: 0.5,
    });

    expect(defaultColorOf(legend)).toBe('rgba(238, 230, 218, 0.5)');
  });

  test('leaves the legends untouched at full opacity', () => {
    const legends = [quantitative];

    expect(applyLegendOpacity({ legends, fillOpacity: 1 })).toBe(legends);
    expect(applyLegendOpacity({ legends })).toBe(legends);
  });

  test('leaves a legend with no colorBy alone', () => {
    const plain: LegendSpec = { id: 'texto', title: 'Só texto' };

    const [legend] = applyLegendOpacity({
      legends: [plain],
      fillOpacity: 0.4,
    });

    expect(legend).toBe(plain);
  });

  /*
   * A categorical legend keeps its `mapping`, which this does not reach. Better
   * to leave it whole than to half-fade it.
   */
  test('leaves a colorBy without a colours list intact', () => {
    const [legend] = applyLegendOpacity({
      legends: [categorical],
      fillOpacity: 0.4,
    });

    expect(legend.colorBy).toEqual(categorical.colorBy);
  });

  test('passes through a colour that is not 6-digit hex', () => {
    const odd: LegendSpec = {
      ...quantitative,
      colorBy: {
        ...quantitative.colorBy,
        colors: ['hsl(200 50% 50%)', '#fff'],
        defaultColor: 'transparent',
      },
    } as LegendSpec;

    const [legend] = applyLegendOpacity({ legends: [odd], fillOpacity: 0.3 });

    expect(colorsOf(legend)).toEqual(['hsl(200 50% 50%)', '#fff']);
    expect(defaultColorOf(legend)).toBe('transparent');
  });

  test('re-colours every legend it is given', () => {
    const legends = applyLegendOpacity({
      legends: [quantitative, quantitative],
      fillOpacity: 0.2,
    });

    expect(legends).toHaveLength(2);
    expect(colorsOf(legends[1])?.[0]).toBe('rgba(198, 219, 239, 0.2)');
  });
});
