import type { KitchenEnabledShare2025 } from '@/data-gateway/schema';
import type { StaticKitchenEnabledShareSource } from '@/data-source-static/readStaticKitchenEnabledShare2025';

export const enabledShareSource: StaticKitchenEnabledShareSource = {
  year: 2025,
  nationalTotal: 10,
  nationalEnabled: 3,
  unresolvedEnabled: 0,
  registeredMunicipalities: [
    {
      code: '3550308',
      name: 'São Paulo',
      uf: 'SP',
      total: 8,
      enabled: 2,
      anchor: [-46.6, -23.5],
    },
    {
      code: '3304557',
      name: 'Rio de Janeiro',
      uf: 'RJ',
      total: 2,
      enabled: 1,
      anchor: [-43.2, -22.9],
    },
  ],
  municipalities: [
    {
      code: '3550308',
      name: 'São Paulo',
      uf: 'SP',
      count: 2,
      anchor: [-46.6, -23.5],
    },
    {
      code: '3304557',
      name: 'Rio de Janeiro',
      uf: 'RJ',
      count: 1,
      anchor: [-43.2, -22.9],
    },
  ],
};
export const enabledShareSnapshot: KitchenEnabledShare2025 = {
  year: 2025,
  nationalTotal: 10,
  nationalEnabled: 3,
  unresolvedEnabled: 0,
  municipalCoverage: [
    {
      codigoIbge: '3550308',
      municipio: 'São Paulo',
      uf: 'SP',
      registeredCount: 8,
      enabledCount: 2,
      enabledPercent: 25,
      anchor: [-46.6, -23.5],
    },
    {
      codigoIbge: '3304557',
      municipio: 'Rio de Janeiro',
      uf: 'RJ',
      registeredCount: 2,
      enabledCount: 1,
      enabledPercent: 50,
      anchor: [-43.2, -22.9],
    },
  ],
  municipalities: [
    {
      codigoIbge: '3550308',
      municipio: 'São Paulo',
      uf: 'SP',
      enabledCount: 2,
      sharePercent: 20,
      anchor: [-46.6, -23.5],
    },
    {
      codigoIbge: '3304557',
      municipio: 'Rio de Janeiro',
      uf: 'RJ',
      enabledCount: 1,
      sharePercent: 10,
      anchor: [-43.2, -22.9],
    },
  ],
};
