# cozsolidarias

Public Next.js app that visualizes food-security and social-assistance data for Brazilian municipalities. Data flows through a single boundary: `src/app → src/data-gateway → src/data-source-*`.

## Language

**Dataset Catalog**:
The descriptive registry of all known datasets (`public/dataset_catalogue.json`), listing collections, datasets, and fields as metadata for humans and for AI grounding. It describes what data _could_ exist, not the values themselves.
_Avoid_: catalogue, data catalog (when referring to actual data)

**Renderable Dataset**:
A Dataset Catalog entry that has a complete path to real values through `data-gateway`, and can therefore be used to populate a spec's `mapData`. As of this writing: `cozinhas_geolocalizadas`, `cozinhas_geolocalizadas_2025`, `municipios_ivs`, `municipios_cadinsan`. Most catalog entries are not renderable — they are pure geometry, unexposed, or only partially wired.
_Avoid_: available dataset, real dataset

**MapData Append**:
The server-side step that replaces the placeholder `mapData` emitted by the spec-generation agent with real values resolved from `data-gateway`, keyed by Renderable Dataset id. Runs inside `POST /api/ai/spec`, before the spec reaches any client.
_Avoid_: data injection, data hydration
