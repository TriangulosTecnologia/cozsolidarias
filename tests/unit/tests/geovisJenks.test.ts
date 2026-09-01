import { resolveChoropleth } from 'src/app/(features)/mapas/geovisChoroplethRows';
import {
  buildLegends,
  jenksBreaksForMode,
  type MapMode,
} from 'src/app/(features)/mapas/geovisScales';
import type { kitchenRateByCity } from 'src/data-gateway/schema';

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

describe('resolveChoropleth', () => {
  /** Eight municípios with distinct counts — enough to clear every ad-hoc floor. */
  const buildByCity = (): kitchenRateByCity[] => {
    return Array.from({ length: 8 }, (_, index) => {
      return {
        codigoIbge: String(100 + index),
        municipio: `M${index}`,
        quantidade: index + 1,
        populacao: 100_000,
        porCemMil: index + 1,
        percentualDoBrasil: index + 1,
        pessoasCadUnico: 50_000,
        porDezMilCadUnico: index + 1,
        pessoasPorCozinha: (index + 1) * 1000,
      };
    });
  };

  const sources = (byCity: kitchenRateByCity[]) => {
    return { byCity, ivsByCity: [], cafByCity: [], cadinsanByCity: [] };
  };

  test('reuses the fit when a mode is revisited with the same snapshots', () => {
    const snapshot = sources(buildByCity());

    const first = resolveChoropleth({ mode: 'coropletico', ...snapshot });
    const second = resolveChoropleth({ mode: 'coropletico', ...snapshot });

    // Reference equality is the assertion: `classifyValues` returns a fresh
    // array on every fit, so the same array can only mean it did not refit.
    expect(second.jenksBreaks).toBe(first.jenksBreaks);
    expect(first.jenksBreaks).not.toBeNull();

    // Rows are deliberately not cached — cheap to rebuild, costly to pin.
    expect(second.rows).not.toBe(first.rows);
    expect(second.rows).toEqual(first.rows);
  });

  test('refits when a snapshot is replaced', () => {
    const first = resolveChoropleth({
      mode: 'coropletico-taxa',
      ...sources(buildByCity()),
    });
    const second = resolveChoropleth({
      mode: 'coropletico-taxa',
      ...sources(buildByCity()),
    });

    // Same values, but a new array reference — the memo must not assume the
    // data is unchanged just because it looks the same.
    expect(second.jenksBreaks).not.toBe(first.jenksBreaks);
    expect(second.jenksBreaks).toEqual(first.jenksBreaks);
  });

  test('caches each mode separately', () => {
    const snapshot = sources(buildByCity());

    const counts = resolveChoropleth({ mode: 'coropletico', ...snapshot });
    const perCapita = resolveChoropleth({
      mode: 'coropletico-percentual',
      ...snapshot,
    });

    // Two modes off one snapshot: the second must not read the first's entry.
    expect(perCapita.jenksBreaks).not.toBe(counts.jenksBreaks);
    expect(
      resolveChoropleth({ mode: 'coropletico', ...snapshot }).jenksBreaks
    ).toBe(counts.jenksBreaks);
  });

  test('keeps the fixed scale for a mode that is not Jenks-eligible', () => {
    const snapshot = sources(buildByCity());

    // IVS reads official faixas, so there is nothing to fit and nothing to cache.
    expect(
      resolveChoropleth({ mode: 'coropletico-ivs', ...snapshot }).jenksBreaks
    ).toBeNull();
  });
});
