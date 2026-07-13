'use client';

import * as React from 'react';

import type {
  CozinhasFeatureCollection,
  CozinhasStatusFeatureCollection,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

/** `{ codigoIbge: nome }` for every Brazilian município, keyed by `codarea`. */
export type NomesPorCodigo = Record<string, string>;

/** Empty collection used until `/api/cozinhas/status` resolves (or fails). */
const EMPTY_STATUS_COLLECTION: CozinhasStatusFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** Empty collection used until `/api/cozinhas` resolves (or fails). */
const EMPTY_COZINHAS_COLLECTION: CozinhasFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Loads the map's five datasets on mount: per-município counts/rates, the
 * IVS-family snapshot, the município name catalog, the plain cozinha points and
 * the status-carrying cozinha points. `mounted` flips only after all five
 * settle; on any failure the map falls back to empty data (every município
 * renders "sem cozinha" and tooltips use the fallback labels).
 */
export const useMapaData = () => {
  const [mounted, setMounted] = React.useState(false);
  const [kitchenByCity, setKitchenByCity] = React.useState<kitchenRateByCity[]>(
    []
  );
  const [ivsByCity, setIvsByCity] = React.useState<MunicipioIvs[]>([]);
  const [nomesPorCodigo, setNomesPorCodigo] = React.useState<NomesPorCodigo>(
    {}
  );
  const [cozinhas, setCozinhas] = React.useState<CozinhasFeatureCollection>(
    EMPTY_COZINHAS_COLLECTION
  );
  const [cozinhasStatus, setCozinhasStatus] =
    React.useState<CozinhasStatusFeatureCollection>(EMPTY_STATUS_COLLECTION);

  React.useEffect(() => {
    let cancelled = false;

    const finish = (
      data: kitchenRateByCity[],
      ivs: MunicipioIvs[],
      nomes: NomesPorCodigo,
      cozinhasData: CozinhasFeatureCollection,
      status: CozinhasStatusFeatureCollection
    ) => {
      if (cancelled) {
        return;
      }
      setKitchenByCity(data);
      setIvsByCity(ivs);
      setNomesPorCodigo(nomes);
      setCozinhas(cozinhasData);
      setCozinhasStatus(status);
      setMounted(true);
    };

    Promise.all([
      fetch('/api/cozinhas/por-municipio').then((response) => {
        return response.json() as Promise<kitchenRateByCity[]>;
      }),
      fetch('/api/municipios/ivs').then((response) => {
        return response.json() as Promise<MunicipioIvs[]>;
      }),
      fetch('/geo/municipios-nomes.json').then((response) => {
        return response.json() as Promise<NomesPorCodigo>;
      }),
      fetch('/api/cozinhas').then((response) => {
        return response.json() as Promise<CozinhasFeatureCollection>;
      }),
      fetch('/api/cozinhas/status').then((response) => {
        return response.json() as Promise<CozinhasStatusFeatureCollection>;
      }),
    ])
      .then(([data, ivs, nomes, cozinhasData, status]) => {
        finish(
          data,
          Array.isArray(ivs) ? ivs : [],
          nomes,
          Array.isArray(cozinhasData?.features)
            ? cozinhasData
            : EMPTY_COZINHAS_COLLECTION,
          Array.isArray(status?.features) ? status : EMPTY_STATUS_COLLECTION
        );
      })
      .catch(() => {
        // Falha silenciosa: o mapa renderiza todo na cor "sem cozinha" e o
        // tooltip cai no rótulo de fallback "Município <código>".
        finish([], [], {}, EMPTY_COZINHAS_COLLECTION, EMPTY_STATUS_COLLECTION);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    mounted,
    kitchenByCity,
    ivsByCity,
    nomesPorCodigo,
    cozinhas,
    cozinhasStatus,
  };
};
