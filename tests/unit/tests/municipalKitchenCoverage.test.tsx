import '@testing-library/jest-dom';

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { screen } from '@testing-library/react';
import type { VisualizationSpec } from '@ttoss/geovis';

import {
  isCadinsanMode,
  quintileLabels,
  sharedCadinsanQuintiles,
} from '@/app/(features)/mapas/cadinsanQuintiles';
import { resolveChoropleth } from '@/app/(features)/mapas/geovisChoroplethRows';
import { colorForCadinsan } from '@/app/(features)/mapas/geovisChoroplethScales';
import { withMunicipalCoverage } from '@/app/(features)/mapas/geovisMunicipalCoverage';
import { buildLegends } from '@/app/(features)/mapas/geovisScales';
import { buildSpec } from '@/app/(features)/mapas/geovisSpec';
import { renderMunicipioTooltip } from '@/app/(features)/mapas/mapaTooltips';
import { municipalCoverageTooltip } from '@/app/(features)/mapas/municipalCoverageTooltip';
import {
  coverageByQuintile,
  coverageClass,
  coverageRadius,
  coverageRiskCuts,
} from '@/app/(features)/mapas/municipalKitchenCoverage';
import { municipalPieSvg } from '@/app/(features)/mapas/municipalKitchenPie';
import { toKitchenEnabledShare2025 } from '@/data-gateway/transformers/toKitchenEnabledShare2025';
import { parseKitchenEnabledShare2025 } from '@/data-source-static/readStaticKitchenEnabledShare2025';

import { coverageRisks } from '../fixtures/coverageRisks';
import {
  enabledShareSnapshot,
  enabledShareSource,
} from '../fixtures/enabledShare';
import { renderWithChakra } from './renderWithChakra';

const withMapaBoundaries = (spec: VisualizationSpec): VisualizationSpec => {
  return {
    ...spec,
    sources: [
      ...spec.sources,
      {
        id: 'municipios-boundary',
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    ],
  };
};
const validateSpec = (spec: VisualizationSpec): { status: string } => {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        '-e',
        "process.stdout.write(JSON.stringify(require('@ttoss/geovis').validateSpec(JSON.parse(process.argv[1]))))",
        JSON.stringify(spec),
      ],
      { encoding: 'utf8' }
    )
  );
};

const base = () => {
  return withMapaBoundaries(buildSpec([]));
};
const specFor = (
  active: boolean,
  summary: boolean,
  scenario: 'com' | 'sem' = 'com'
) => {
  return withMunicipalCoverage({
    spec: base(),
    snapshot: enabledShareSnapshot,
    active,
    summary,
    risks: coverageRisks,
    scenario,
  });
};

test('shares exact pooled quintiles, includes zero and merges ties without splitting identical values', () => {
  expect(sharedCadinsanQuintiles(coverageRisks)).toEqual([0, 10, 20, 30, 40]);
  expect(sharedCadinsanQuintiles([])).toEqual([0]);
  expect(
    sharedCadinsanQuintiles([
      { ...coverageRisks[0], proporcaoComPbf: null, proporcaoSemPbf: NaN },
    ])
  ).toEqual([0]);
  expect(
    sharedCadinsanQuintiles([
      { ...coverageRisks[0], proporcaoComPbf: 0, proporcaoSemPbf: 0 },
    ])
  ).toEqual([0]);
  expect(quintileLabels([0, 10])).toEqual([
    'Sem dado',
    'Q1: 0% ≤ valor < 10%',
    'Q2: ≥ 10%',
  ]);
  expect(isCadinsanMode('coropletico-cadinsan-com-pbf')).toBe(true);
  expect(isCadinsanMode('coropletico-cadinsan-sem-pbf')).toBe(true);
  expect(isCadinsanMode('pontos')).toBe(false);
  expect(
    resolveChoropleth({
      mode: 'coropletico-cadinsan-com-pbf',
      byCity: [],
      ivsByCity: [],
      cafByCity: [],
    }).jenksBreaks
  ).toEqual([0]);
  for (const mode of [
    'coropletico-cadinsan-com-pbf',
    'coropletico-cadinsan-sem-pbf',
  ] as const) {
    const args = {
      mode,
      byCity: [],
      ivsByCity: [],
      cafByCity: [],
      cadinsanByCity: coverageRisks,
    };
    const first = resolveChoropleth(args);
    expect(resolveChoropleth(args).jenksBreaks).toBe(first.jenksBreaks);
    expect(first.jenksBreaks).toEqual([0, 10, 20, 30, 40]);
    const legend = buildLegends(mode, first.jenksBreaks).find((row) => {
      return row.id.endsWith(mode.endsWith('sem-pbf') ? 'sem-pbf' : 'com-pbf');
    })!;
    expect(legend.colorBy).toMatchObject({ thresholds: [0, 10, 20, 30, 40] });
    expect(legend.labelFormat).toMatchObject({
      labels: quintileLabels([0, 10, 20, 30, 40]),
    });
  }
});

test('preserves complete municipality denominators and uses count-weighted aggregation', () => {
  const coverage =
    toKitchenEnabledShare2025(enabledShareSource).municipalCoverage;
  expect(
    coverage.map((row) => {
      return row.enabledPercent;
    })
  ).toEqual([25, 50]);
  const sameRisk = coverageRisks.slice(0, 2).map((row) => {
    return { ...row, proporcaoComPbf: 10, proporcaoSemPbf: 10 };
  });
  const groups = coverageByQuintile(coverage, sameRisk, 'com');
  expect(groups.at(-1)).toEqual({
    enabled: 3,
    registered: 10,
    municipalities: 2,
  });
  expect(
    coverageByQuintile(coverage, coverageRisks, 'sem').reduce((sum, g) => {
      return sum + g.enabled;
    }, 0)
  ).toBe(3);
  expect(coverageByQuintile(coverage, [], 'com')).toEqual([
    { enabled: 0, registered: 0, municipalities: 0 },
  ]);
  expect(
    coverageByQuintile(
      coverage,
      [{ ...sameRisk[0], proporcaoComPbf: null }],
      'com'
    ).every((g) => {
      return g.registered === 0;
    })
  ).toBe(true);
  expect(coverageRadius(4, 100) / coverageRadius(1, 100)).toBe(2);
  expect(coverageRadius(0, 100)).toBe(0);
  expect(coverageRiskCuts([])).toEqual([]);
  expect(coverageRiskCuts(coverageRisks)).toEqual([20, 30]);
  expect(coverageClass(0, 0, [20, 30])).toBe('0');
  expect(coverageClass(30, 100, [20, 30])).toBe('8');
});

test('renders zero, partial, majority and complete sectors with valid small-base SVG outlines', () => {
  for (const percent of [0, 25, 75, 100]) {
    const svg = municipalPieSvg(percent, percent === 25);
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
    expect(parsed.querySelectorAll('path')).toHaveLength(
      percent === 0 || percent === 100 ? 0 : 1
    );
  }
  expect(municipalPieSvg(75)).toContain('0 1,1');
  expect(municipalPieSvg(25, true)).toContain('stroke-dasharray');
});

test.each([
  [true, false, 'com'],
  [true, true, 'com'],
  [true, true, 'sem'],
  [false, false, 'com'],
] as const)(
  'validates spec and independent toggles: %s %s %s',
  (active, summary, scenario) => {
    const spec = specFor(active, summary, scenario);
    expect(validateSpec(spec).status).toBe('resolved');
    const circle = spec.layers.find((row) => {
      return row.id === 'cozinhas-habilitacao-municipal-2025';
    })!;
    expect(circle.visible).toBe(active);
    expect(
      spec.layers.find((row) => {
        return row.id === 'habilitacao-municipal-2025-fill';
      })!.visible
    ).toBe(active && summary);
    expect(
      spec.layers.find((row) => {
        return row.id === 'cozinhas-pts';
      })!.visible
    ).toBe(
      active
        ? false
        : base().layers.find((row) => {
            return row.id === 'cozinhas-pts';
          })!.visible
    );
    circle.hoverTooltip!.render({
      featureId: '3550308',
      layerId: circle.id,
      sourceId: circle.sourceId,
      value: 8,
      point: { x: 0, y: 0 },
    });
  }
);

test('distinguishes no kitchens from no risk, and never invents loading symbols', () => {
  const coverage = [
    ...enabledShareSnapshot.municipalCoverage,
    { ...enabledShareSnapshot.municipalCoverage[0], codigoIbge: 'unknown' },
  ];
  const spec = withMunicipalCoverage({
    spec: {
      ...base(),
      mapData: undefined,
      legends: undefined,
      control: undefined,
      layers: [],
    },
    snapshot: { ...enabledShareSnapshot, municipalCoverage: coverage },
    active: true,
    summary: true,
    risks: [
      ...coverageRisks,
      { ...coverageRisks[0], codigoIbge: 'unknown', proporcaoComPbf: null },
    ],
    scenario: 'com',
  });
  expect(spec.mapData!.at(-1)!.data).toEqual(
    expect.arrayContaining([
      { geometryId: '3205309', value: 'no-kitchen' },
      { geometryId: 'unknown', value: 'no-risk' },
    ])
  );
  expect(
    withMunicipalCoverage({
      spec: base(),
      snapshot: null,
      active: false,
      summary: false,
      risks: [],
      scenario: 'com',
    }).mapData!.at(-2)!.data
  ).toEqual([]);
  const noRisk = withMunicipalCoverage({
    spec: base(),
    snapshot: enabledShareSnapshot,
    active: true,
    summary: true,
    risks: [],
    scenario: 'sem',
  });
  expect(
    noRisk.mapData!.at(-1)!.data.every((row) => {
      return row.value === 'no-risk';
    })
  ).toBe(true);
});

test('tooltip exposes Tm numerator, denominator, uncertainty and modeled risk', () => {
  const { unmount } = renderWithChakra(
    <>
      {municipalCoverageTooltip(
        '3304557',
        enabledShareSnapshot.municipalCoverage,
        coverageRisks
      )}
    </>
  );
  expect(screen.getByText('50% habilitadas (Tm)')).toBeInTheDocument();
  expect(screen.getByText(/Base pequena/)).toBeInTheDocument();
  expect(screen.getByText(/CADINSAN com PBF/)).toBeInTheDocument();
  unmount();
  const { unmount: second } = renderWithChakra(
    <>
      {municipalCoverageTooltip(
        '3550308',
        enabledShareSnapshot.municipalCoverage,
        []
      )}
    </>
  );
  expect(screen.getByText(/CADINSAN indisponível/)).toBeInTheDocument();
  second();
  const { unmount: third } = renderWithChakra(
    <>{municipalCoverageTooltip('3550308', [], coverageRisks)}</>
  );
  expect(screen.getByText(/Sem cozinha no cadastro/)).toBeInTheDocument();
  third();
  const { unmount: fourth } = renderWithChakra(
    <>{municipalCoverageTooltip('unknown', [], [])}</>
  );
  expect(screen.getByText('Município unknown')).toBeInTheDocument();
  fourth();
  renderWithChakra(
    <>
      {municipalCoverageTooltip(
        '3550308',
        enabledShareSnapshot.municipalCoverage,
        [{ ...coverageRisks[0], proporcaoComPbf: null, proporcaoSemPbf: null }]
      )}
    </>
  );
  expect(screen.getByText(/CADINSAN com PBF: sem dado/)).toBeInTheDocument();
});

test('tooltip swatch uses the same shared cutpoints as the fill', () => {
  const cuts = sharedCadinsanQuintiles(coverageRisks);
  expect(colorForCadinsan(10, undefined, cuts)).toBe(
    colorForCadinsan(10, undefined, [0, 10, 20, 30, 40])
  );
  renderWithChakra(
    <>
      {renderMunicipioTooltip({
        mode: 'coropletico-cadinsan-com-pbf',
        name: 'SP',
        cadinsanRegister: coverageRisks[0],
        cadinsanThresholds: cuts,
        value: 0,
      })}
    </>
  );
  expect(
    screen.getByText(/em risco de insegurança alimentar grave/)
  ).toBeInTheDocument();
});

test('reconciles every registered kitchen including municipalities with zero habilitadas', () => {
  const raw = JSON.parse(
    readFileSync(
      'src/data-source-static/data/kitchen-enabled-share-2025.json',
      'utf8'
    )
  );
  const source = parseKitchenEnabledShare2025(JSON.stringify(raw));
  expect(source.registeredMunicipalities).toHaveLength(904);
  expect(
    source.registeredMunicipalities.reduce((sum, row) => {
      return sum + row.total;
    }, 0)
  ).toBe(5913);
  expect(
    source.registeredMunicipalities.filter((row) => {
      return row.enabled === 0;
    })
  ).toHaveLength(640);
  expect(
    new Set(
      raw.registeredAssignments.map((row: { kitchenCode: string }) => {
        return row.kitchenCode;
      })
    ).size
  ).toBe(5913);
});

test.each([
  null,
  {},
  { code: 'bad' },
  { ...enabledShareSource.registeredMunicipalities[0], anchor: null },
  { ...enabledShareSource.registeredMunicipalities[0], total: '8' },
  { ...enabledShareSource.registeredMunicipalities[0], total: 0 },
  { ...enabledShareSource.registeredMunicipalities[0], enabled: '2' },
  { ...enabledShareSource.registeredMunicipalities[0], enabled: 9 },
])('rejects invalid municipal denominator %j', (row) => {
  expect(() => {
    return parseKitchenEnabledShare2025(
      JSON.stringify({ ...enabledShareSource, registeredMunicipalities: [row] })
    );
  }).toThrow('Invalid enabled kitchen snapshot');
});
test.each(
  [undefined, null, {}, []].map((rows) => {
    return { rows };
  })
)('rejects missing or unreconciled denominator list %j', ({ rows }) => {
  expect(() => {
    return parseKitchenEnabledShare2025(
      JSON.stringify({
        ...enabledShareSource,
        registeredMunicipalities: rows,
      })
    );
  }).toThrow();
});
test.each(
  [
    [
      ...enabledShareSource.registeredMunicipalities,
      enabledShareSource.registeredMunicipalities[0],
    ],
    enabledShareSource.registeredMunicipalities.map((row) => {
      return {
        ...row,
        total: row.total + 1,
      };
    }),
    enabledShareSource.registeredMunicipalities.map((row) => {
      return {
        ...row,
        enabled: 0,
      };
    }),
    enabledShareSource.registeredMunicipalities.map((row) => {
      return {
        ...row,
        enabled: row.code === '3550308' ? 1 : 2,
      };
    }),
    enabledShareSource.registeredMunicipalities.map((row) => {
      return {
        ...row,
        code: row.code === '3550308' ? '3550300' : row.code,
      };
    }),
  ].map((rows) => {
    return { rows };
  })
)(
  'rejects denominator reconciliation or cross-numerator mismatch',
  ({ rows }) => {
    expect(() => {
      return parseKitchenEnabledShare2025(
        JSON.stringify({
          ...enabledShareSource,
          registeredMunicipalities: rows,
        })
      );
    }).toThrow('Municipal denominator reconciliation failed');
  }
);
