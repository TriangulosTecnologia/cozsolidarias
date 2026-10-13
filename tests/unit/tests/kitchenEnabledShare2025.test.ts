import { readFileSync } from 'node:fs';

import { GET } from '@/app/api/cozinhas/habilitadas-participacao/route';
import { createDataGateway } from '@/data-gateway/createDataGateway';
import {
  findMunicipio,
  indexMunicipios,
} from '@/data-gateway/transformers/municipioIndex';
import { toKitchenEnabledShare2025 } from '@/data-gateway/transformers/toKitchenEnabledShare2025';
import { readStaticCozinhas } from '@/data-source-static/readStaticCozinhas';
import {
  parseKitchenEnabledShare2025,
  readStaticKitchenEnabledShare2025,
} from '@/data-source-static/readStaticKitchenEnabledShare2025';

import { enabledShareSource } from '../fixtures/enabledShare';

test('uses all national kitchens as denominator, not municipal totals or enabled total', () => {
  const result = toKitchenEnabledShare2025(enabledShareSource);
  expect(
    result.municipalities.map((row) => {
      return row.sharePercent;
    })
  ).toEqual([20, 10]);
  expect(result.nationalTotal).toBe(10);
  expect(result.municipalities[0].anchor).not.toBe(
    enabledShareSource.municipalities[0].anchor
  );
});

test('serves the complete reconciled 2025 snapshot through the gateway and public route', async () => {
  const source = await readStaticKitchenEnabledShare2025();
  expect(await readStaticKitchenEnabledShare2025()).toBe(source);
  const result = await createDataGateway().getKitchenEnabledShare2025();
  expect(result).toMatchObject({
    year: 2025,
    nationalTotal: 5913,
    nationalEnabled: 1013,
    unresolvedEnabled: 0,
  });
  expect(result.municipalities).toHaveLength(264);
  expect(
    result.municipalities.reduce((sum, row) => {
      return sum + row.enabledCount;
    }, 0)
  ).toBe(1013);
  expect(
    result.municipalities.reduce((sum, row) => {
      return sum + row.sharePercent;
    }, 0)
  ).toBeCloseTo((100 * 1013) / 5913, 10);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(result);
  expect(JSON.stringify(result)).not.toMatch(/kitchenCode|assignments|sha256/);
});

test('keeps every habilitada, including 256 without coordinates, and validates interior anchors', async () => {
  const rows = await readStaticCozinhas({ year: 2025 });
  const snapshot = JSON.parse(
    readFileSync(
      'src/data-source-static/data/kitchen-enabled-share-2025.json',
      'utf8'
    )
  );
  const enabled = rows.filter((row) => {
    return row.situacao === 'Habilitada';
  });
  expect(
    enabled.filter((row) => {
      return row.latitude === null || row.longitude === null;
    })
  ).toHaveLength(256);
  expect(
    new Set(
      snapshot.assignments.map((row: { kitchenCode: string }) => {
        return row.kitchenCode;
      })
    )
  ).toEqual(
    new Set(
      enabled.map((row) => {
        return row.codigo;
      })
    )
  );
  const index = indexMunicipios(
    JSON.parse(readFileSync('public/geo/geojs-100-mun.json', 'utf8'))
  );
  for (const row of snapshot.registeredMunicipalities) {
    expect(findMunicipio({ index, point: row.anchor })?.codigoIbge).toBe(
      row.code
    );
  }
  expect(
    parseKitchenEnabledShare2025(JSON.stringify(enabledShareSource))
  ).toEqual(enabledShareSource);
});

test.each([
  null,
  1,
  {},
  { ...enabledShareSource, year: 2026 },
  { ...enabledShareSource, nationalTotal: '10' },
  { ...enabledShareSource, nationalTotal: -1 },
  { ...enabledShareSource, nationalTotal: 1.5 },
  { ...enabledShareSource, nationalEnabled: -1 },
  { ...enabledShareSource, unresolvedEnabled: 1 },
  { ...enabledShareSource, municipalities: null },
  ...[
    null,
    {},
    { ...enabledShareSource.municipalities[0], code: 3 },
    { ...enabledShareSource.municipalities[0], code: 'abc' },
    { ...enabledShareSource.municipalities[0], name: null },
    { ...enabledShareSource.municipalities[0], uf: null },
    { ...enabledShareSource.municipalities[0], count: -1 },
    { ...enabledShareSource.municipalities[0], anchor: null },
    { ...enabledShareSource.municipalities[0], anchor: [1] },
    { ...enabledShareSource.municipalities[0], anchor: [1, null] },
  ].map((row) => {
    return { ...enabledShareSource, municipalities: [row] };
  }),
])('rejects malformed source %j', (value) => {
  expect(() => {
    return parseKitchenEnabledShare2025(JSON.stringify(value));
  }).toThrow('Invalid enabled kitchen snapshot');
});

test.each([
  {
    ...enabledShareSource,
    municipalities: [
      ...enabledShareSource.municipalities,
      enabledShareSource.municipalities[0],
    ],
  },
  { ...enabledShareSource, nationalTotal: 0 },
  { ...enabledShareSource, nationalTotal: 2 },
  { ...enabledShareSource, nationalEnabled: 4 },
])('rejects invalid reconciliation %j', (value) => {
  expect(() => {
    return parseKitchenEnabledShare2025(JSON.stringify(value));
  }).toThrow('reconciliation failed');
});
