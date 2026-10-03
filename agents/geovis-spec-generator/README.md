# geovis-spec-generator agent

[Naturali formation](https://docs.naturali.ai/docs/modules/formations.md) for the agent that `POST /api/ai/spec` calls. The app knows the agent only by `NATURALI_AGENT_ID`; this folder is outside the pnpm workspace and nothing in the app imports it.

`formation.json` declares two resources:

- `validate_spec_tool`, a `client` tool. Each call pauses the generation, and the route answers it with `validateCandidate`.
- `geovis_spec_generator_loop`, the agent bound to that tool, with its `instructions` and the `output_schema` the route parses.

## Commands

The CLI reads `NATURALI_TOKEN` (a `nat_sk_…` key) and `NATURALI_PROJECT`. The app's `.env` holds the same values as `NATURALI_API_KEY` and `NATURALI_PROJECT_ID`.

```bash
export NATURALI_TOKEN=nat_sk_...
export NATURALI_PROJECT=proj_PZf6AoddrCGQkwkJ
export NATURALI_FORMATION_ID=form_u4byEDCIaWR9w132

pnpm --dir agents/geovis-spec-generator validate  # type-checks the template, creates nothing
pnpm --dir agents/geovis-spec-generator plan      # diff against the live stack, changes nothing
pnpm --dir agents/geovis-spec-generator deploy    # applies it to the production agent
```

Run `plan` before every `deploy`: it lists what the deploy would create, update or delete.

Change the agent here and deploy it. Don't edit the agent through its own API: that leaves this file and the formation behind, so the next `deploy` reverts the edit. This has happened once: agent v3 (2026-10-01) was set directly, and `formation.json` was then taken from the live agent rather than from the formation's stored template.
