import {
  buildLegends,
  jenksBreaksForMode,
  type MapMode,
} from 'src/app/(features)/mapas/geovisScales';

/** A wide, all-distinct sample that clears every ad-hoc mode's floor and band count. */
const SAMPLE = Array.from({ length: 50 }, (_, index) => {
  return index + 1;
});

/** The ad-hoc choropleths, their fixed floor, band count, and grey "no data" label. */
const AD_HOC: {
  mode: MapMode;
  floor: number;
  classes: number;
  firstLabel: string;
}[] = [
  { mode: 'coropletico', floor: 1, classes: 5, firstLabel: 'Sem cozinha' },
  {
    mode: 'coropletico-taxa',
    floor: 0.001,
    classes: 6,
    firstLabel: 'Sem dado',
  },
  {
    mode: 'coropletico-percentual',
    floor: 0.01,
    classes: 6,
    firstLabel: 'Sem cozinha',
  },
  {
    mode: 'coropletico-cafs-percentual',
    floor: 0.00001,
    classes: 6,
    firstLabel: 'Sem CAF',
  },
  {
    mode: 'coropletico-cadinsan-com-pbf',
    floor: 0,
    classes: 5,
    firstLabel: 'Sem dado',
  },
  {
    mode: 'coropletico-cadinsan-sem-pbf',
    floor: 0,
    classes: 5,
    firstLabel: 'Sem dado',
  },
  {
    mode: 'coropletico-cadunico',
    floor: 0.01,
    classes: 6,
    firstLabel: 'Sem cozinha',
  },
  {
    mode: 'coropletico-pessoas-cozinha',
    floor: 1,
    classes: 6,
    firstLabel: 'Sem cozinha',
  },
];

describe('jenksBreaksForMode', () => {
  test.each(AD_HOC)(
    '$mode → breaks that keep the fixed floor and band count',
    ({ mode, floor, classes }) => {
      const breaks = jenksBreaksForMode(mode, SAMPLE);
      expect(breaks).not.toBeNull();
      expect(breaks).toHaveLength(classes);
      expect(breaks?.[0]).toBe(floor);
    }
  );

  test('returns null for the IVS/IDHM families (official faixas never change)', () => {
    expect(jenksBreaksForMode('coropletico-ivs', SAMPLE)).toBeNull();
    expect(jenksBreaksForMode('coropletico-idhm', SAMPLE)).toBeNull();
  });

  test('returns null for non-choropleth overlay modes', () => {
    expect(jenksBreaksForMode('pontos', SAMPLE)).toBeNull();
    expect(jenksBreaksForMode('assentamentos', SAMPLE)).toBeNull();
  });

  test('returns null when the data has too few distinct values to split', () => {
    expect(jenksBreaksForMode('coropletico', [2, 2, 2])).toBeNull();
  });

  test('ignores non-numeric row values (string/null) before fitting', () => {
    const clean = jenksBreaksForMode('coropletico', SAMPLE);
    const noisy = jenksBreaksForMode('coropletico', [null, '999', ...SAMPLE]);
    expect(noisy).toEqual(clean);
  });
});

describe('buildLegends with Jenks breaks', () => {
  test.each(AD_HOC)(
    '$mode: the active legend paints and labels the data-driven breaks',
    ({ mode, firstLabel }) => {
      const breaks = jenksBreaksForMode(mode, SAMPLE) ?? [];
      const legend = buildLegends(mode, breaks).find((entry) => {
        return entry.position === 'bottom-right';
      });

      // Fill and legend share this colorBy, so asserting it covers both.
      expect(legend?.colorBy).toMatchObject({ thresholds: breaks });
      // Labels are rebuilt from the same breaks: grey bin first, one per band.
      expect(legend?.labelFormat).toMatchObject({ type: 'labels' });
      const labels = (legend?.labelFormat as { labels: string[] }).labels;
      expect(labels[0]).toBe(firstLabel);
      expect(labels).toHaveLength(breaks.length + 1);
    }
  );

  test('the count legend formats single-value, range, and open-top bands', () => {
    const legend = buildLegends('coropletico', [1, 2, 3, 10, 20]).find(
      (entry) => {
        return entry.position === 'bottom-right';
      }
    );
    const labels = (legend?.labelFormat as { labels: string[] }).labels;
    expect(labels).toEqual(['Sem cozinha', '1', '2', '3–9', '10–19', '20+']);
  });

  test('a fixed IVS/IDHM legend ignores breaks and keeps its official faixas', () => {
    const withBreaks = buildLegends('coropletico-ivs', [9, 9, 9, 9, 9]).find(
      (entry) => {
        return entry.position === 'bottom-right';
      }
    );
    const withoutBreaks = buildLegends('coropletico-ivs').find((entry) => {
      return entry.position === 'bottom-right';
    });
    expect(withBreaks?.colorBy).toEqual(withoutBreaks?.colorBy);
  });
});
