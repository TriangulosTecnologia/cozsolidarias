# brand

Canonical brand package for **Cozinha Solidária em Rede**. Everything downstream — the
site, decks, print, partner materials — should resolve here rather than to a copy.

| File                                                      | What it is                                                                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`brand-spec.json`](./brand-spec.json)                    | Canonical operating contract (Branding Studio schema v4). Strategy, creative direction, design tokens, verified contrast pairs, evidence, open questions. Machine-readable; the single source of truth for values. |
| [`brand-book.md`](./brand-book.md)                        | The teaching document. Why the system behaves as it does and how to apply it. Read this first.                                                                                                                     |
| [`logo/`](./logo)                                         | 24 signature masters (4 lockups × 6 variants) plus 2 badges.                                                                                                                                                       |
| [`illustration/`](./illustration)                         | 24 drawn food illustrations as vector masters.                                                                                                                                                                     |
| [`illustration/raster-only/`](./illustration/raster-only) | 10 further illustrations that exist only as small PNGs — no vector source was delivered. Small sizes only; do not enlarge or recolour.                                                                             |
| [`pattern/`](./pattern)                                   | Seamless food pattern tile, in two inks.                                                                                                                                                                           |
| [`reference/`](./reference)                               | Rendered applications showing the composition grammar across five different jobs.                                                                                                                                  |

## Picking an asset

Logo files are named `<lockup>-<variant>.svg`.

- **Lockup** — `vertical` (primary), `horizontal`, `stacked`, `wordmark`, or `badge-pot` /
  `badge-csr`.
- **Variant** — `color`, `color-on-dark`, `white`, `black`, `red`, `green`.

Choose the variant by the ground, never by preference:

| Ground                              | Variant                   |
| ----------------------------------- | ------------------------- |
| Branco Leitura, paper, pale imagery | `color`                   |
| Preto or neutral dark               | `color-on-dark`           |
| **Vermelho or Verde**               | **`white`**               |
| Single-ink production               | `black`, `red` or `green` |

Below 90 px wide, switch to `badge-pot` instead of scaling the signature down further.

## Making something new

Three rules cover most of it; the [brand book](./brand-book.md) covers the rest.

1. **Split the surface into voz and mesa.** Voz is a flat brand colour and carries the
   signature and the headline. Mesa is Branco Leitura and carries the food, the data and
   the body text. Illustrations go on mesa, never on a saturated ground.
2. **Set everything in Libre Franklin.** Weight carries the hierarchy; Light only at 18px
   and above.
3. **Name the actor.** Write who does what, let numbers carry the argument, and never use
   the charity register — no _beneficiários_, no _doação_.

## Provenance

The mark, lettering, illustrations and pattern come from the identity delivered by LM&Co.
in June 2026. Masters were extracted as vector directly from its native Adobe Illustrator
source (`MANUAL DE IDENTIDADE VISUAL - COZINHA SOLIDÁRIA.ai`, 2026-06-23) — no raster
tracing, no retyped values. Each file is plain `<path>` geometry with a `viewBox`, no
embedded images, no external references, no script, and no live font dependency.

The system around them — typography, the voz/mesa composition grammar, voice and the
partner signature — was designed on top of that handoff, which resolved the signature but
not what to do with it. Every rule was tested by building the artefact and looking at it.

Four decisions deliberately depart from the 2026 manual, each recorded as evidence in the
spec and argued in the brand book: the brand red (`E-001`), the green used for _Em Rede_
on dark grounds (`E-002`), the typeface (`E-010`), and the white lockup on saturated
grounds (`E-009`). Read those before "correcting" any of them back.

## Conventions

Asset filenames are English kebab-case: they are design artifacts handled by designers and
vendors, not source modules, so the repository's camelCase rule does not apply to them.
SVG `<title>` text is pt-BR because screen readers announce it to the people who read the
brand's own materials.

This folder is derived from the brand handoff alone — the 2026 manual and the delivered
Identidade Visual archive. Nothing here is decided by, or documents, anything elsewhere in
the repository.

Colour values live in `brand-spec.json` under `visual.tokens` and are deliberately not
duplicated into a second tokens file. Two copies of a palette drift apart, and the red
recorded in `E-001` is what that looks like when it happens.

## Verifying a change

The [Branding Studio](https://github.com/enniolopes/skills) scripts check the mechanical
properties — schema, token resolution, contrast maths, SVG portability. They establish
nothing about strategic or aesthetic quality.

```bash
SKILL=.claude/skills/branding-studio/scripts

python3 "$SKILL/validate_structure.py" brand/brand-spec.json
python3 "$SKILL/asset_checks.py" brand/logo/horizontal-color.svg
python3 "$SKILL/color_tools.py" contrast '#559870' '#000000' large
```

`validate_structure.py` reports one standing advisory: the Verde Claro pairing carries a
modest APCA signal. That is expected and explained in `visual.palette.green_light_tradeoff`
— it is not a regression.
