/**
 * The left sidebar's declarative configuration: the variation menu, the
 * time-lapse tab and the hexagon grid's settings tab.
 *
 * Split from `MapaPlayground` because it is data, not behaviour — three tabs'
 * worth of copy, icons and gates that the component only hands to
 * `<GeovisWorkspace>`. The menu ids come back with it, since they are the
 * contract between this config and the component reading the selection.
 */

import type { GeovisWorkspaceConfig } from '@ttoss/geovis-workspace';

import { DEFAULT_CAF_HEXBIN_RESOLUTION } from '@/data-gateway/schema';

import { DEFAULT_CAF_HEXBIN_OPACITY } from './geovisCafHexbin';
import type { MapMode } from './geovisSpec';
import {
  colorRampOptions,
  type CustomRamp,
  DEFAULT_COLOR_RAMP,
} from './mapaColorRamp';

/** Id of the left-sidebar menu group that drives the visualization mode. */
export const MODE_MENU_ID = 'visualizacao';

/** Shared-selection key the time-lapse timeline writes the current year to. */
export const YEAR_MENU_ID = 'ano';

/** Id of the settings menu driving the grid's H3 resolution. */
export const MESH_MENU_ID = 'malha';

/** Id of the settings menu driving the grid's fill opacity, in percent. */
export const OPACITY_MENU_ID = 'opacidade';

/** Id of the settings menu driving which ramp the graduated fills are read through. */
export const COLOR_RAMP_MENU_ID = 'cores';

/**
 * Whether each mode's subject is read through a graduated ramp the reader can
 * re-colour.
 *
 * A `Record<MapMode, …>` for the same reason {@link TAKES_OPACITY} is one: the
 * compiler is what keeps it complete, so a new mode has to answer the question
 * instead of silently inheriting an answer.
 *
 * `true` wherever the fill *is* a ladder of colours: every choropleth —
 * including the IVS and IDHM families, which have their own palettes and are
 * re-coloured like any other — and the hexagon grid, whose cells are classified
 * on a scale of their own but read through a ramp just the same.
 *
 * `false` where there is no ladder to redraw: the kitchen points and their
 * proportional circles read by position and size over a flat backdrop, the
 * settlements colour categorically, and the CAF hierarchy is a tiled pyramid.
 */
/**
 * What the page hands in so the colour block can offer ramp building.
 *
 * Optional as a pair: without somewhere to report, the affordance would mint a
 * ramp nothing keeps.
 */
export type RampHandlers = {
  /** The ramps the reader has built so far, listed after the shipped ones. */
  list: CustomRamp[];
  /** The reader finished building one. */
  onCreate: (params: { option: CustomRamp }) => void;
  /** The reader dismissed one they had built. */
  onRemove: (params: { id: string }) => void;
};

/**
 * The colours the ramp editor opens on.
 *
 * The map's own sequential families, so a built ramp starts from the same
 * vocabulary the shipped ones are drawn from rather than from a generic wheel.
 */
const RAMP_BASE_COLORS = [
  { id: 'azul', name: 'Azul', color: '#2171B5' },
  { id: 'verde', name: 'Verde', color: '#238B45' },
  { id: 'laranja', name: 'Laranja', color: '#D94801' },
  { id: 'vermelho', name: 'Vermelho', color: '#CB181D' },
  { id: 'roxo', name: 'Roxo', color: '#6A51A3' },
  { id: 'cinza', name: 'Cinza', color: '#636363' },
];

const TAKES_COLOR_RAMP: Record<MapMode, boolean> = {
  coropletico: true,
  'coropletico-taxa': true,
  'coropletico-percentual': true,
  'coropletico-cafs-percentual': true,
  'coropletico-cadinsan-com-pbf': true,
  'coropletico-cadinsan-sem-pbf': true,
  'coropletico-cadunico': true,
  'coropletico-pessoas-cozinha': true,
  'coropletico-ivs': true,
  'coropletico-ivs-infraestrutura': true,
  'coropletico-ivs-capital-humano': true,
  'coropletico-ivs-renda-trabalho': true,
  'coropletico-idhm': true,
  'coropletico-idhm-longevidade': true,
  'coropletico-idhm-educacao': true,
  'coropletico-idhm-renda': true,
  'coropletico-idhm-educacao-escolaridade': true,
  'coropletico-idhm-educacao-frequencia': true,
  pontos: false,
  circulos: false,
  assentamentos: false,
  cafs: false,
  'cafs-hexbin': true,
};

/** Whether the colour-ramp block is offered for a mode. */
export const modeTakesColorRamp = (mode: MapMode): boolean => {
  return TAKES_COLOR_RAMP[mode];
};

/**
 * The resolution ladder, one rung per generated snapshot.
 *
 * The rung's value is the H3 resolution itself, so the slider publishes exactly
 * what the grid's route takes. Labels are the cell's width on the ground, which
 * is what the reader is choosing between; the hint is what that costs, since a
 * step down multiplies the cells — and the file — by about seven.
 */
const MESH_STOPS = [
  { value: 3, label: '~120 km', hint: '1,1 mil células' },
  { value: 4, label: '~45 km', hint: '6 mil células' },
  { value: 5, label: '~17 km', hint: '35 mil células' },
];

/** Mode shown before the sidebar seeds `selection[MODE_MENU_ID]`. */
export const DEFAULT_MODE: MapMode = 'coropletico';

/** Year shown before the timeline seeds `selection[YEAR_MENU_ID]` (latest snapshot). */
export const DEFAULT_YEAR = 2026;

/**
 * Visualization modes whose data carries a year, so the timeline describes
 * something. Only the kitchen locations do: every choropleth here is a single
 * snapshot per município, and the assentamentos overlay has no time dimension
 * either.
 *
 * Typed as `MapMode[]` on purpose. The gate below matches these strings against
 * the shared selection, and the variations that produce that selection are
 * declared as plain strings further down — so the type is what keeps the two
 * from drifting: renaming a member of the `MapMode` union breaks this line at
 * compile time instead of quietly leaving the tab disabled forever.
 */
const MODES_WITH_TIMELINE: MapMode[] = ['pontos'];

/**
 * Whether each mode's subject layer takes the opacity setting.
 *
 * A `Record<MapMode, …>` rather than a list, so the compiler is what keeps it
 * complete: adding a member to the union breaks this object until the new mode
 * answers the question. A list would silently leave it out, and the tab would
 * be missing from a mode nobody remembered to add.
 *
 * `true` wherever the município fill carries meaning the reader may want to
 * dial back — every choropleth and the hexagon grid, where the fill IS the
 * subject, plus `pontos` and `circulos`, where it is the flat backdrop the
 * marks sit on and fading it lets the basemap through.
 *
 * `false` for the CAF hierarchy, whose subject is a tiled pyramid the fill has
 * nothing to do with, and for `assentamentos`, which swaps the município fill
 * for the estados one and colours it categorically.
 */
const TAKES_OPACITY: Record<MapMode, boolean> = {
  coropletico: true,
  'coropletico-taxa': true,
  'coropletico-percentual': true,
  'coropletico-cafs-percentual': true,
  'coropletico-cadinsan-com-pbf': true,
  'coropletico-cadinsan-sem-pbf': true,
  'coropletico-cadunico': true,
  'coropletico-pessoas-cozinha': true,
  'coropletico-ivs': true,
  'coropletico-ivs-infraestrutura': true,
  'coropletico-ivs-capital-humano': true,
  'coropletico-ivs-renda-trabalho': true,
  'coropletico-idhm': true,
  'coropletico-idhm-longevidade': true,
  'coropletico-idhm-educacao': true,
  'coropletico-idhm-renda': true,
  'coropletico-idhm-educacao-escolaridade': true,
  'coropletico-idhm-educacao-frequencia': true,
  'cafs-hexbin': true,
  pontos: true,
  circulos: true,
  assentamentos: false,
  cafs: false,
};

/** The modes whose settings tab is live. */
const MODES_WITH_OPACITY = (Object.keys(TAKES_OPACITY) as MapMode[]).filter(
  (mode) => {
    return TAKES_OPACITY[mode];
  }
);

/** Whether the settings tab — and therefore the opacity — is live for a mode. */
export const modeTakesOpacity = (mode: MapMode): boolean => {
  return TAKES_OPACITY[mode];
};

/** Whether a mode's opacity applies to the hexagon grid rather than the fill. */
export const modeUsesHexbinOpacity = (mode: MapMode): boolean => {
  return mode === 'cafs-hexbin';
};

/** Left sidebar drives the visualization mode. */
/**
 * Left sidebar: the cozinhas visualizations as a card with two icon tabs —
 * "Variações" (a flat, icon-led list) and "Timeline". Drives the shared
 * `visualizacao` selection (same `menuId` + values), so switching a variation
 * recolors the map.
 *
 * Neither section declares `header.title`, so geovis-workspace 0.13 draws no
 * header band at all and the tab bar takes the top of the card, close button
 * included. Two consequences shape the config below. Each tab is named by its
 * section `id` (`header.title ?? section.id`), on hover and for assistive tech
 * alike, so those ids read as labels — declaring a title to name one tab would
 * bring the band back for both. And the `variations` body heads itself with its
 * own `title`/`icon`, since with no band its rows would otherwise start against
 * the tab bar with nothing naming them.
 *
 * The "Timeline" tab is gated on the variation: it is live only for
 * {@link MODES_WITH_TIMELINE} and dims everywhere else. Dimming rather than
 * dropping the section is deliberate — the tab bar would reflow on every
 * variation switch, and a dimmed tab reads as *unavailable* where a missing one
 * reads as *gone*.
 */
/** The variation menu: every mode the map can draw, grouped for ordering. */
const VARIATION_GROUPS = [
  {
    id: 'cozinhas',
    label: 'Cozinhas',
    variations: [
      {
        value: 'coropletico',
        label: 'Cozinhas por município (coroplético)',
        icon: 'lucide:map',
      },
      {
        value: 'coropletico-taxa',
        label: 'nº coz. no município / 100.000 hab.',
        icon: 'lucide:users',
      },
      {
        value: 'coropletico-percentual',
        label: '% das cozinhas do Brasil no município',
        icon: 'lucide:percent',
      },
      {
        value: 'coropletico-cafs-percentual',
        label: '% dos CAFs do Brasil no município',
        icon: 'lucide:wheat',
      },
      {
        value: 'coropletico-cadinsan-com-pbf',
        label: 'Insegurança alimentar — cenário com o Bolsa Família',
        icon: 'lucide:utensils-crossed',
      },
      {
        value: 'coropletico-cadinsan-sem-pbf',
        label: 'Insegurança alimentar — cenário sem o Bolsa Família',
        icon: 'lucide:utensils',
      },
      {
        value: 'coropletico-cadunico',
        label: 'nº coz. / 10 mil pessoas no CadÚnico',
        icon: 'lucide:clipboard-list',
      },
      {
        value: 'coropletico-pessoas-cozinha',
        label: 'pessoas no CadÚnico por cozinha',
        icon: 'lucide:user-round',
      },
    ],
  },
  {
    id: 'ivs',
    label: 'IVS',
    variations: [
      {
        value: 'coropletico-ivs',
        label: 'Índice de vulnerabilidade social',
        icon: 'lucide:shield-alert',
      },
      {
        value: 'coropletico-ivs-infraestrutura',
        label: 'IVS Infraestrutura Urbana',
        icon: 'lucide:building-2',
      },
      {
        value: 'coropletico-ivs-capital-humano',
        label: 'IVS Capital Humano',
        icon: 'lucide:graduation-cap',
      },
      {
        value: 'coropletico-ivs-renda-trabalho',
        label: 'IVS Renda e Trabalho',
        icon: 'lucide:briefcase',
      },
    ],
  },
  {
    id: 'idhm',
    label: 'IDHM',
    variations: [
      {
        value: 'coropletico-idhm',
        label: 'Índice de Desenvolvimento Humano Municipal',
        icon: 'lucide:trending-up',
      },
      {
        value: 'coropletico-idhm-longevidade',
        label: 'IDHM Longevidade',
        icon: 'lucide:heart-pulse',
      },
      {
        value: 'coropletico-idhm-educacao',
        label: 'IDHM Educação',
        icon: 'lucide:book-open',
      },
      {
        value: 'coropletico-idhm-renda',
        label: 'IDHM Renda',
        icon: 'lucide:dollar-sign',
      },
      {
        value: 'coropletico-idhm-educacao-escolaridade',
        label: 'IDHM Educação — Escolaridade',
        icon: 'lucide:pencil-ruler',
      },
      {
        value: 'coropletico-idhm-educacao-frequencia',
        label: 'IDHM Educação — Frequência Escolar',
        icon: 'lucide:calendar-check',
      },
    ],
  },
  {
    id: 'camadas',
    label: 'Camadas',
    variations: [
      {
        value: 'pontos',
        label: 'Localização das cozinhas',
        icon: 'lucide:map-pin',
      },
      {
        value: 'circulos',
        label: 'Cozinhas por município',
        icon: 'lucide:circle-dot',
      },
      {
        value: 'assentamentos',
        label: 'Assentamentos e cozinhas',
        icon: 'lucide:house',
      },
      {
        value: 'cafs',
        label: 'CAFs (pf)',
        icon: 'lucide:tractor',
      },
      {
        value: 'cafs-hexbin',
        label: 'CAFs (hexbin-pf)',
        icon: 'lucide:hexagon',
      },
    ],
  },
];

/**
 * Every variation the menu offers, which is exactly what a shared link may
 * name. Derived from the menu rather than written beside it: a value the
 * sidebar does not draw is one no link should be able to ask for, and a list
 * kept by hand would let the two drift the first time a variation is renamed.
 */
export const MAP_MODE_VALUES = VARIATION_GROUPS.flatMap((group) => {
  return group.variations.map((variation) => {
    return variation.value as MapMode;
  });
});

const VARIATIONS_SECTION: NonNullable<
  GeovisWorkspaceConfig['leftSidebar']
>['sections'][number] = {
  id: 'Variações',
  header: {
    icon: 'lucide:layout-list',
  },
  body: {
    kind: 'variations',
    title: 'Variações',
    icon: 'lucide:layout-list',
    menuId: MODE_MENU_ID,
    defaultValue: 'coropletico',
    groups: VARIATION_GROUPS,
  },
};

/** The time-lapse tab. */
const TIMELINE_SECTION: NonNullable<
  GeovisWorkspaceConfig['leftSidebar']
>['sections'][number] = {
  id: 'Timeline',
  header: {
    icon: 'lucide:clock',
  },
  // Live only where the data has a year. While the gate is closed the tab
  // dims, playback is suspended, and the year already published stays in the
  // selection — a closed gate freezes the timeline, it does not reset it, so
  // returning to a kitchen-locations view lands on the same year.
  enabledWhen: { menuId: MODE_MENU_ID, values: MODES_WITH_TIMELINE },
  body: {
    kind: 'filters',
    blocks: [
      {
        id: 'periodo',
        title: 'Linha do tempo',
        icon: 'lucide:calendar-clock',
        // No `collapsible`: geovis-workspace 0.13 stopped collapsing filter
        // blocks by default, and this is the only block in its tab — there
        // is no neighbour for it to push off screen. A fixed header, so the
        // timeline is always in reach. (`defaultOpen` lived here and is now
        // read only when a block opts into collapsing.)
        control: {
          kind: 'timeline',
          // Drives the shared selection so the map reacts to the year.
          menuId: YEAR_MENU_ID,
          min: 2025,
          max: 2026,
          step: 1,
          defaultValue: DEFAULT_YEAR,
        },
      },
    ],
  },
};

/**
 * The settings tab, which is the one section that differs per mode: only the
 * hexagon grid has a resolution to choose, and `enabledWhen` gates whole
 * sections rather than blocks.
 */
const buildSettingsSection = ({
  mode,
  ramps,
}: {
  mode: MapMode;
  ramps?: RampHandlers;
}): NonNullable<GeovisWorkspaceConfig['leftSidebar']>['sections'][number] => {
  return {
    id: 'Configurações',
    header: {
      icon: 'lucide:settings',
    },
    // Live wherever a fill is the thing being read — see `TAKES_OPACITY`.
    // Gating rather than dropping keeps the tab bar's layout fixed across
    // modes, so the tab reads as unavailable instead of appearing and
    // vanishing as variations change.
    enabledWhen: { menuId: MODE_MENU_ID, values: MODES_WITH_OPACITY },
    body: {
      kind: 'settings',
      blocks: [
        // The mesh is the one block that is not about every mode: only the
        // hexagon grid has a resolution to choose. `enabledWhen` gates whole
        // sections, not blocks, so the block is omitted per mode instead —
        // which is why this config is built per mode rather than declared
        // once.
        ...(modeUsesHexbinOpacity(mode)
          ? [
              {
                id: 'malha',
                title: 'Malha de hexágonos',
                icon: 'lucide:hexagon',
                control: {
                  kind: 'slider' as const,
                  menuId: MESH_MENU_ID,
                  stops: MESH_STOPS,
                  defaultValue: DEFAULT_CAF_HEXBIN_RESOLUTION,
                  endLabels: ['Panorâmico', 'Detalhado'] as [string, string],
                  stepButtons: true,
                },
              },
            ]
          : []),
        {
          id: 'opacidade',
          title: 'Opacidade',
          icon: 'lucide:droplets',
          control: {
            kind: 'slider' as const,
            menuId: OPACITY_MENU_ID,
            min: 30,
            max: 100,
            step: 5,
            // Per mode, because the two subjects open differently: the
            // choropleth fill is opaque, while the grid opens at 85 so the
            // basemap's coastline stays legible under the palest cells. Only
            // read at mount — once the reader moves the slider the value is
            // theirs, and it travels with them across modes.
            defaultValue: modeUsesHexbinOpacity(mode)
              ? DEFAULT_CAF_HEXBIN_OPACITY * 100
              : 100,
            unit: '%',
            endLabels: ['Transparente', 'Opaca'] as [string, string],
            stepButtons: true,
          },
        },
        // Offered wherever the fill is a ladder of colours — see
        // `TAKES_COLOR_RAMP`. Omitted per mode for the same reason the mesh is:
        // `enabledWhen` gates whole sections, not blocks.
        ...(modeTakesColorRamp(mode)
          ? [
              {
                id: 'cores',
                title: 'Cores',
                icon: 'lucide:palette',
                control: {
                  kind: 'colorRamp' as const,
                  menuId: COLOR_RAMP_MENU_ID,
                  defaultValue: DEFAULT_COLOR_RAMP,
                  options: colorRampOptions({ custom: ramps?.list }),
                  // Offered only when the page hands in the handlers: the
                  // ramps the reader builds are the page's to keep, and an
                  // affordance with nowhere to report would mint a ramp that
                  // vanishes on the next render.
                  ...(ramps
                    ? {
                        create: {
                          baseColors: RAMP_BASE_COLORS,
                          onCreate: ramps.onCreate,
                        },
                        onRemove: ramps.onRemove,
                      }
                    : {}),
                },
              },
            ]
          : []),
      ],
    },
  };
};

/**
 * The left sidebar's configuration for one mode.
 *
 * A function rather than a constant because the settings tab's blocks depend on
 * the mode — see {@link buildSettingsSection}.
 *
 * @param mode - The mode the map is drawing.
 * @returns The `leftSidebar` config.
 *
 * @example
 * buildLeftSidebar({ mode: 'coropletico' }).sections.length; // 3
 */
export const buildLeftSidebar = ({
  mode,
  ramps,
}: {
  mode: MapMode;
  ramps?: RampHandlers;
}): NonNullable<GeovisWorkspaceConfig['leftSidebar']> => {
  return {
    initialState: 'open',
    sections: [
      VARIATIONS_SECTION,
      TIMELINE_SECTION,
      buildSettingsSection({ mode, ramps }),
    ],
  };
};
