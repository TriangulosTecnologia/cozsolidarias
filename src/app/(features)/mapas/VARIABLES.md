# MapaPlayground Variables Specification

## Constants

### MODE_MENU_ID

- **Type:** `string`
- **Value:** `'visualizacao'`
- **Purpose:** ID of left-sidebar menu group that drives visualization mode selection
- **Usage:** Key for `GeovisWorkspaceSelection` to track active variation

### YEAR_MENU_ID

- **Type:** `string`
- **Value:** `'ano'`
- **Purpose:** Shared-selection key where timeline writes current year
- **Usage:** Key for `GeovisWorkspaceSelection` to track selected year

### DEFAULT_MODE

- **Type:** `MapMode`
- **Value:** `'coropletico'`
- **Purpose:** Fallback mode shown before sidebar initializes
- **Usage:** Fallback when `selection[MODE_MENU_ID]` undefined

### DEFAULT_YEAR

- **Type:** `number`
- **Value:** `2026`
- **Purpose:** Fallback year shown before timeline initializes (latest snapshot)
- **Usage:** Fallback when `selection[YEAR_MENU_ID]` undefined or invalid

### MODES_WITH_TIMELINE

- **Type:** `MapMode[]`
- **Value:** `['pontos']`
- **Purpose:** Modes whose data carries time dimension (only kitchen locations have years)
- **Usage:** Gate timeline visibility; prevents timeline for modes without time data

### LEFT_SIDEBAR

- **Type:** `GeovisWorkspaceConfig['leftSidebar']`
- **Structure:** Object with `initialState` and `sections` array
  - `sections[0]`: Variations card with two tabs (Variações + Timeline)
  - `sections[1]`: Timeline filter block (gated on `MODES_WITH_TIMELINE`)
- **Purpose:** Left sidebar configuration for the GeovisWorkspace
- **Behavior:** Tab bar takes top; no header band; dimmed tabs freeze state on close gate

### scopedSidebarTheme

- **Type:** Theme UI theme object
- **Extends:** `BruttalTheme`
- **Key Modification:** `config.useRootStyles: false`
- **Purpose:** Prevents theme-ui `<RootStyles>` global injection that would clobber Chakra tokens
- **Behavior:** Sidebars still get theme colors via CSS custom properties; app header unaffected

## Component State

### selection

- **Type:** `GeovisWorkspaceSelection`
- **Shape:** `Record<string, string | number | boolean>`
- **Keys:** `'visualizacao'` (mode), `'ano'` (year), others from sidebar config
- **Initialization:** `getInitialSelection({ config: { leftSidebar: LEFT_SIDEBAR } })`
- **Update:** `setSelection()` called by `handleVariableChange`
- **Purpose:** Shared state for all sidebar selections; drives map redraw

### mode

- **Type:** `MapMode`
- **Computed from:** `(selection[MODE_MENU_ID] ?? DEFAULT_MODE) as MapMode`
- **Purpose:** Active visualization mode selected in sidebar
- **Derived:** Cast from selection; drives data loading and spec generation

### specMode

- **Type:** `MapMode`
- **State:** `React.useState(mode)`
- **Lags:** `mode` by exactly one data-load request
- **Purpose:** Prevents rendering before datasets arrive
- **Constraint:** Map draws `specMode`; empty join would flash "sem dado"

### year

- **Type:** `number`
- **Computed from:** `selection[YEAR_MENU_ID]` (fallback `DEFAULT_YEAR`)
- **Validation:** `Number.isFinite(yearFromSelection) ? yearFromSelection : DEFAULT_YEAR`
- **Purpose:** Active year for kitchen locations and filtered snapshots
- **Behavior:** Timeline scrubbing and play animation swap without round-trip via this value

## Data (useMapaDatasets)

### datasets

- **Type:** Object returned by `useMapaDatasets(mode)`
- **Properties:**
  - `data`: Kitchen-count per city (choropleth join data)
  - `ivs`: IVS indices per city
  - `nomes`: Name mapping
  - `settlements`: Settlement GeoJSON
  - `cafsByCity`: CAF counts per city
  - `cafPontosPorUf`: CAF points per state
  - `cadinsanByCity`: CADINSAN data per city
  - `cafHexbin`: Hexbin aggregation data
- **Lifecycle:** One snapshot per mode, loaded on-demand
- **Purpose:** All data for current mode; cached in memory

### ready

- **Type:** `boolean`
- **Lifecycle:** From `useMapaDatasets`
- **Purpose:** Gates CSS application to avoid flexing layout during load indicator
- **Behavior:** False during fetch; true when `datasets` populated

### ensure

- **Type:** `(mode: MapMode) => Promise<void> | undefined`
- **From:** `useMapaDatasets`
- **Behavior:** Returns pending promise if mode not loaded; undefined if already cached
- **Purpose:** Triggers prefetch; drives "menus live while loading" pattern

## Kitchen Data (useKitchensByYear)

### cozinhasPoints

- **Type:** GeoJSON FeatureCollection of kitchen point geometries
- **Key:** Feature properties include `codigo` (id)
- **Lifecycle:** Cached per year; prefetched for all years
- **Purpose:** Layer geometry for kitchen location modes
- **Behavior:** Swaps on year change without round-trip via cache

### collections

- **Type:** `Record<number, CozinhasFeatureCollection>`
- **Key:** Year → feature collection for that year
- **Spans:** All loaded years (not just selected year)
- **Purpose:** Multi-year lookup for status continuity during crossfades
- **Constraint:** Outgoing dots linger mid-transition; need full-span lookup to avoid blanking

### cozinhaNames

- **Type:** `Record<string, string>`
- **Key:** Kitchen `codigo` → kitchen name
- **Computed from:** All collections merged, selected year last (wins on conflict)
- **Purpose:** Cook name display in inspector detail
- **Memoized:** Recreated when `collections` or `year` changes

### cozinhaStatus

- **Type:** `Record<string, string>`
- **Key:** Kitchen `codigo` → status string (`'Em funcionamento'`, `'Paralisada'`, etc.)
- **Computed from:** All collections merged, selected year last (wins on conflict)
- **Purpose:** Point color via legend mapping
- **Invariant:** Missing código → falls through to masked (white) fallback

## Config & Rendering

### config

- **Type:** `GeovisWorkspaceConfig`
- **Key Properties:**
  - `appearance: 'bare'` → no card border/radius
  - `leftSidebar: LEFT_SIDEBAR`
  - `rightSidebar` (conditional: kitchen detail if mode shows it)
  - `slots`: Map panel override, legend/warnings/metadata hidden, inspector gated on rightSidebar
- **Computed when:** `specMode` or `year` changes
- **Purpose:** GeovisWorkspace configuration object

### spec

- **Type:** Output of `useMapaSpec()`
- **Input Props:**
  - `kitchenByCity`: Choropleth join data
  - `ivsByCity`: IVS indices
  - `nomesPorCodigo`: Name lookup
  - `assentamentos`: Settlement GeoJSON
  - `cozinhaNames`: Code → name map
  - `cozinhaStatus`: Code → status map
  - `cafByCity`: CAF counts
  - `cafPontosPorUf`: CAF points per state
  - `cadinsanByCity`: CADINSAN data
  - `cafHexbin`: Hexbin data
  - `mode: specMode`
  - `cozinhasPoints`: Kitchen locations
- **Output Type:** `VisualizationSpec` (maplibre-based spec for geovis-workspace)
- **Purpose:** Complete map specification (layers, legends, data joins, styling)

## Event Handlers

### handleVariableChange

- **Signature:** `(next: GeovisWorkspaceSelection) => Promise<void> | undefined`
- **Behavior:**
  1. Commit selection change (`setSelection(next)`)
  2. Extract next mode from selection
  3. Call `ensure(nextMode)` to trigger load if needed
  4. If pending, wait for promise; then `setSpecMode(nextMode)`
  5. If already cached, immediately set mode and return undefined
- **Purpose:** Drives "row highlights while data loads" UX
- **Row Lock:** User's clicked row spins while others dim; map waits for data arrival

### mapLayoutCss

- **Type:** Chakra CSS object
- **Applied when:** `ready === true`
- **Rules:**
  - Outer Box: full-height flex column
  - Workspace wrapper child: `height: 100%`, `width: 100%`, flex column
  - Map layout child: `flex: 1`, `minHeight: 0` (prevents flex children from overflowing)
- **Purpose:** Stretches map to fill viewport; overlays (legends, tooltips) remain positioned absolute
- **Gate:** Only apply when map rendered (not during loading indicator)
