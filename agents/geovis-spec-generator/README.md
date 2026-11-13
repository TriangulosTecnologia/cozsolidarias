# geovis-spec-generator agent

[Naturali formation](https://docs.naturali.ai/docs/modules/formations.md) for the agent that `POST /api/ai/spec` calls. The app knows the agent only by `NATURALI_AGENT_ID`; this folder is outside the pnpm workspace and nothing in the app imports it.

`formation.json` declares two resources:

- `validate_spec_tool`, a `client` tool. Each call pauses the generation, and the route answers it with `validateCandidate`.
- `geovis_spec_generator_loop`, the agent bound to that tool, with its `instructions` and the `output_schema` the route parses.

## Reply contract

The agent returns `{status: "ok", spec}` or `{status: "error", error}`. `spec` is a minimal `VisualizationSpec`: `mapType`, `title`, `description`, `mapData[]` (`mapDataId`, `title`), top-level `legends[]` (`title`, `subtitle`, `reference`, `noDataLabel`), optional `sources[]` (a served path, e.g. `/api/cozinhas?ano=2025`) and, for a points or heatmap map without `mapType`, `layers[]` (`sourceId`, `geometry`). It never carries legend scales, colors, sizes or data rows: `resolveCandidate` in [`serveSpec.ts`](../../src/app/api/ai/spec/serveSpec.ts) derives `mapId`, layer ids and well-known sources, fetches the real data, expands `mapType` with the geovis resolver (each generated legend takes the text of the agent legend at its `mapData` position, official IVS/IDHM faixas) and resolves API sources. The `validate_spec` tool runs the same resolution before it reports issues.

## Commands

The CLI reads `NATURALI_TOKEN` (a `nat_sk_…` key) and `NATURALI_PROJECT_ID`. The app's `.env` holds the same values as `NATURALI_TOKEN` and `NATURALI_PROJECT_ID`. `scripts/update-instructions.mjs` reads `NATURALI_TOKEN` from that `.env`.

```bash
export NATURALI_TOKEN=nat_sk_...
export NATURALI_PROJECT_ID=proj_PZf6AoddrCGQkwkJ
export NATURALI_FORMATION_ID=form_u4byEDCIaWR9w132

pnpm --dir agents/geovis-spec-generator validate  # type-checks the template, creates nothing
pnpm --dir agents/geovis-spec-generator plan      # diff against the live stack, changes nothing
pnpm --dir agents/geovis-spec-generator deploy    # applies it to the production agent
```

Run `plan` before every `deploy`: it lists what the deploy would create, update or delete.

## Syncing the instructions

`scripts/update-instructions.mjs` concatenates `instructions/*.md` (sorted by filename) into `formation.json`. Add, rename or delete a section file, then run it:

| Command                                        | Writes `formation.json` | Pushes to the live agent | Exit code                              |
| ---------------------------------------------- | ----------------------- | ------------------------ | -------------------------------------- |
| `node scripts/update-instructions.mjs --check` | no                      | no                       | 1 when `formation.json` is out of sync |
| `node scripts/update-instructions.mjs`         | yes                     | no                       | 0                                      |
| `node scripts/update-instructions.mjs --apply` | yes                     | yes                      | 0                                      |

Environment variables:

| Variable              | Read from                         | Required       | Used for                             |
| --------------------- | --------------------------------- | -------------- | ------------------------------------ |
| `NATURALI_TOKEN`      | repo `.env` (overrides the shell) | with `--apply` | authenticates `naturali patch-agent` |
| `NATURALI_PROJECT_ID` | environment or `.env`             | with `--apply` | `--project-id`                       |
| `NATURALI_AGENT_ID`   | environment or `.env`             | with `--apply` | `--agent-id` (the live agent)        |

Run `--check` before committing. Run `--apply` only after `plan` shows the formation is the intended one.

Change the agent here and deploy it. Don't edit the agent through its own API: that leaves this file and the formation behind, so the next `deploy` reverts the edit. This has happened once: agent v3 (2026-10-01) was set directly, and `formation.json` was then taken from the live agent rather than from the formation's stored template.
