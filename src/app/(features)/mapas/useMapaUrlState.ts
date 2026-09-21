/**
 * The settings that travel in the address bar, so a map can be shared as a link
 * and open on what the sender was looking at: which variation, how opaque its
 * fill is, and which ramp it is read through.
 *
 * `window` directly rather than `useSearchParams`: `MapaPlayground` is loaded
 * with `ssr: false`, so this only ever runs in the browser, and the App Router
 * hook would pull the whole page into dynamic rendering and want a `Suspense`
 * boundary for a value that is read once.
 */

import type { GeovisWorkspaceSelection } from '@ttoss/geovis-workspace';
import * as React from 'react';

import type { MapMode } from './geovisMapMode';
import { colorRampOptions } from './mapaColorRamp';
import {
  COLOR_RAMP_MENU_ID,
  DEFAULT_MODE,
  MAP_MODE_VALUES,
  MODE_MENU_ID,
  modeTakesColorRamp,
  modeTakesOpacity,
  OPACITY_MENU_ID,
} from './mapaLeftSidebar';

/**
 * The settings that travel, and the parameter each one travels under.
 *
 * Named the way the sidebar names the control to a reader rather than the way
 * the code keys it: a link is something people read and sometimes edit, and
 * `variacao` is the word the tab uses where the selection says `visualizacao`.
 */
export const URL_PARAMS: { menuId: string; param: string }[] = [
  { menuId: MODE_MENU_ID, param: 'variacao' },
  { menuId: OPACITY_MENU_ID, param: 'opacidade' },
  { menuId: COLOR_RAMP_MENU_ID, param: 'cores' },
];

/** The parameter a menu travels under. */
const paramFor = (menuId: string): string => {
  return (
    URL_PARAMS.find((entry) => {
      return entry.menuId === menuId;
    })?.param ?? menuId
  );
};

/** The lowest and highest fill opacity the slider offers, in percent. */
const OPACITY_RANGE = { min: 30, max: 100 };

/** The variation a query string asks for, if this map draws it. */
const variacaoFrom = (params: URLSearchParams): MapMode | undefined => {
  const asked = params.get(paramFor(MODE_MENU_ID));

  return MAP_MODE_VALUES.find((value) => {
    return value === asked;
  });
};

/** The opacity a query string asks for, if the slider could have produced it. */
const opacidadeFrom = (params: URLSearchParams): string | undefined => {
  const asked = Number(params.get(paramFor(OPACITY_MENU_ID)));

  return Number.isInteger(asked) &&
    asked >= OPACITY_RANGE.min &&
    asked <= OPACITY_RANGE.max
    ? String(asked)
    : undefined;
};

/** The ramp a query string asks for, if it is one of the offered ones. */
const coresFrom = (params: URLSearchParams): string | undefined => {
  const asked = params.get(paramFor(COLOR_RAMP_MENU_ID));

  return colorRampOptions().find((option) => {
    return option.id === asked;
  })?.id;
};

/**
 * The settings a query string asks for — only the ones it names, and only the
 * ones this map could have written.
 *
 * Every value is validated, and an invalid one is dropped rather than carried:
 * a link written by hand, or one saved before a variation was renamed, opens on
 * the defaults instead of on nothing at all. The reader who followed it has no
 * way to fix it and no reason to see it fail.
 *
 * @param search - `window.location.search`, with or without its `?`.
 * @returns The settings to open on, as a partial selection.
 *
 * @example
 * selecaoFromSearch('?variacao=coropletico-ivs&cores=vermelho');
 * // { visualizacao: 'coropletico-ivs', cores: 'vermelho' }
 */
export const selecaoFromSearch = (search: string): GeovisWorkspaceSelection => {
  const params = new URLSearchParams(search);

  const asked: GeovisWorkspaceSelection = {
    [MODE_MENU_ID]: variacaoFrom(params),
    [OPACITY_MENU_ID]: opacidadeFrom(params),
    [COLOR_RAMP_MENU_ID]: coresFrom(params),
  };

  return Object.fromEntries(
    Object.entries(asked).filter(([, value]) => {
      return value !== undefined;
    })
  );
};

/** The variation to open on, defaults included, which the rest is read against. */
export const variacaoFromSearch = (search: string): MapMode => {
  return (selecaoFromSearch(search)[MODE_MENU_ID] as MapMode) ?? DEFAULT_MODE;
};

/**
 * Whether a setting belongs in the address for the mode being drawn.
 *
 * A mode that does not offer a control has nothing to say about it, and the
 * value the reader left behind in another variation would only be noise in a
 * link — it is still kept in the selection, so switching back finds it.
 */
const carriedBy = ({
  menuId,
  mode,
}: {
  menuId: string;
  mode: MapMode;
}): boolean => {
  if (menuId === OPACITY_MENU_ID) return modeTakesOpacity(mode);
  if (menuId === COLOR_RAMP_MENU_ID) return modeTakesColorRamp(mode);
  return true;
};

/**
 * The settings that travel in the address, and the way to keep it saying what
 * is on screen.
 *
 * The address is replaced rather than pushed: a reader comparing variations
 * would otherwise have to press back once per variation they tried before they
 * could leave the page at all.
 *
 * @returns The settings the address asked for, and a publisher for later ones.
 *
 * @example
 * const { selecaoInicial, publicarSelecao } = useMapaUrlState();
 */
export const useMapaUrlState = () => {
  // Read once: the address is this map's to write from here on, and re-reading
  // it would fight every replacement below.
  const [selecaoInicial] = React.useState(() => {
    return selecaoFromSearch(window.location.search);
  });

  const publicarSelecao = React.useCallback(
    ({
      selection,
      mode,
      defaults,
    }: {
      selection: GeovisWorkspaceSelection;
      mode: MapMode;
      defaults: GeovisWorkspaceSelection;
    }) => {
      const url = new URL(window.location.href);

      for (const { menuId, param } of URL_PARAMS) {
        const value = selection[menuId];
        // A setting left where the variation opens it is not worth saying: the
        // link is shorter, and what it does name is what the sender changed.
        const carried =
          value !== undefined &&
          value !== defaults[menuId] &&
          carriedBy({ menuId, mode });

        if (carried) {
          url.searchParams.set(param, value);
        } else {
          url.searchParams.delete(param);
        }
      }

      // The variation always travels, default or not: it is what the link is
      // about, and a bare `/mapas` reads as "someone forgot to copy the rest".
      url.searchParams.set(paramFor(MODE_MENU_ID), mode);

      if (url.href === window.location.href) {
        return;
      }

      // `replaceState` rather than the router: nothing about the page is
      // re-rendered by this, and a navigation would remount the map to say
      // something the map already knows.
      window.history.replaceState(window.history.state, '', url);
    },
    []
  );

  return { selecaoInicial, publicarSelecao };
};
