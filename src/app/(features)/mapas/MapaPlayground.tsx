'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import { Box, Heading, NativeSelect, Text } from '@chakra-ui/react';
import {
  GeoVisCanvas,
  GeoVisHoverTooltip,
  GeoVisLegend,
  GeoVisProvider,
  type MapHoverInfo,
} from '@ttoss/geovis';
import * as React from 'react';

import type { kitchenByCity } from '@/data-gateway/schema';

import { buildSpec, type MapMode } from './geovisSpec';

/** `{ codigoIbge: nome }` for every SP município, keyed by `codarea`. */
type NomesPorCodigo = Record<string, string>;

const MapaPlayground = () => {
  const [mounted, setMounted] = React.useState(false);
  const [kitchenByCity, setKitchenByCity] = React.useState<kitchenByCity[]>([]);
  const [nomesPorCodigo, setNomesPorCodigo] = React.useState<NomesPorCodigo>(
    {}
  );
  const [mode, setMode] = React.useState<MapMode>('coropletico');

  React.useEffect(() => {
    let cancelled = false;

    const finish = (data: kitchenByCity[], nomes: NomesPorCodigo) => {
      if (cancelled) {
        return;
      }
      setKitchenByCity(data);
      setNomesPorCodigo(nomes);
      setMounted(true);
    };

    Promise.all([
      fetch('/api/cozinhas/por-municipio').then((response) => {
        return response.json() as Promise<kitchenByCity[]>;
      }),
      fetch('/geo/municipios-sp-nomes.json').then((response) => {
        return response.json() as Promise<NomesPorCodigo>;
      }),
    ])
      .then(([data, nomes]) => {
        finish(data, nomes);
      })
      .catch(() => {
        // Falha silenciosa: o mapa renderiza todo na cor "sem cozinha" e o
        // tooltip cai no rótulo de fallback "Município <código>".
        finish([], {});
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const spec = React.useMemo(() => {
    return buildSpec(kitchenByCity, mode);
  }, [kitchenByCity, mode]);

  const citiesByCode = React.useMemo(() => {
    return new Map(
      kitchenByCity.map((registro) => {
        return [registro.codigoIbge, registro];
      })
    );
  }, [kitchenByCity]);

  const hoverTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      const code = String(info.featureId);
      const register = citiesByCode.get(code);
      // Nome vem do catálogo completo (645 municípios); a contagem, dos dados de
      // cozinha (ausente => 0). Fallback só se o catálogo não tiver o código.
      const name =
        nomesPorCodigo[code] ?? register?.municipio ?? `Município ${code}`;
      const quantity =
        typeof info.value === 'number'
          ? info.value
          : (register?.quantidade ?? 0);

      return (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div>
            {quantity === 0
              ? ''
              : `${quantity} ${quantity === 1 ? 'cozinha' : 'cozinhas'}`}
          </div>
        </div>
      );
    },
    [citiesByCode, nomesPorCodigo]
  );

  return (
    <Box position="relative" h="calc(100vh - 72px)" w="100%" bg="ivory.200">
      {mounted ? (
        <GeoVisProvider spec={spec}>
          <GeoVisCanvas style={{ width: '100%', height: '100%' }} />

          <Box
            position="absolute"
            top={4}
            left={4}
            bg="ivory.50"
            px={4}
            py={3}
            borderRadius="card"
            shadow="card"
            maxW="280px"
          >
            <Heading as="h2" textStyle="title-4" color="text.primary" mb={1}>
              Cozinhas Solidárias
            </Heading>
            <Text textStyle="body-sm" color="text.secondary" mb={3}>
              {mode === 'coropletico'
                ? 'Quanto mais escuro o município, mais cozinhas cadastradas ali. Passe o mouse sobre um município para ver o nome e a quantidade.'
                : 'Cada ponto é uma cozinha solidária cadastrada.'}
            </Text>

            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={mode}
                onChange={(event) => {
                  setMode(event.currentTarget.value as MapMode);
                }}
                aria-label="Visualização do mapa"
              >
                <option value="coropletico">Mapa coroplético</option>
                <option value="pontos">Pontos das cozinhas</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Box>

          {mode === 'coropletico' ? (
            <Box
              position="absolute"
              bottom={4}
              left={4}
              bg="ivory.50"
              px={4}
              py={3}
              borderRadius="card"
              shadow="card"
            >
              <GeoVisLegend legendId="legenda-cozinhas" />
            </Box>
          ) : null}

          <GeoVisHoverTooltip render={hoverTooltip} />
        </GeoVisProvider>
      ) : (
        <Box
          position="absolute"
          inset={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text textStyle="body-sm" color="text.secondary">
            Carregando mapa…
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default MapaPlayground;
