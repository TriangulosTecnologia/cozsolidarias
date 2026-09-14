# brand

Canonical brand package for **Cozinha Solidária em Rede**. Everything downstream — the
site, decks, print, partner materials — should resolve here rather than to a copy.

| File                                   | What it is                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`brand-spec.json`](./brand-spec.json) | Canonical operating contract (Branding Studio schema v4). Strategy, creative direction, design tokens, verified contrast pairs, evidence, open questions. Machine-readable; the single source of truth for values. |
| [`brand-book.md`](./brand-book.md)     | The teaching document. Why the system behaves as it does and how to apply it. Read this first.                                                                                                                     |
| [`logo/`](./logo)                      | 24 signature masters (4 lockups × 6 variants) plus 2 badges.                                                                                                                                                       |
| [`illustration/`](./illustration)      | 24 drawn food illustrations.                                                                                                                                                                                       |
| [`pattern/`](./pattern)                | Seamless food pattern tile, in two inks.                                                                                                                                                                           |

## Picking an asset

Logo files are named `<lockup>-<variant>.svg`.

- **Lockup** — `vertical` (primary), `horizontal`, `stacked`, `wordmark`, or `badge-pot` /
  `badge-csr`.
- **Variant** — `color` (light grounds), `color-on-dark` (dark grounds), `white`, `black`,
  `red`, `green` (single-ink production).

Choose the variant by the ground it sits on. Below 90 px wide, switch to `badge-pot`
instead of scaling the signature down further. Both rules, and the reasoning behind them,
are in the [brand book](./brand-book.md#choosing-a-variant).

## Provenance

Masters were extracted as vector directly from the native Adobe Illustrator source
(`MANUAL DE IDENTIDADE VISUAL - COZINHA SOLIDÁRIA.ai`, LM&Co., 2026-06-23) — no raster
tracing, no retyped values. Each file is plain `<path>` geometry with a `viewBox`, no
embedded images, no external references, no script, and no live font dependency, so it
renders identically anywhere.

Two values deliberately differ from the 2026 manual: the brand red, and the green used for
_Em Rede_ on dark grounds. Both departures are argued in the
[brand book](./brand-book.md#colour) and recorded as evidence `E-001` and `E-002` in the
spec. Read those before "correcting" either one back.

## Conventions

Asset filenames are English kebab-case: they are design artifacts referenced by designers,
vendors and `public/`, not TypeScript modules, so the repository's camelCase rule for
source files does not apply to them. SVG `<title>` text is pt-BR because screen readers
announce it to site visitors.

Colour values live in `brand-spec.json` under `visual.tokens` and are deliberately not
duplicated into a second tokens file — a second copy is how the palette drift recorded in
`E-004` happened in the first place.

## Verifying a change

The [Branding Studio](https://github.com/enniolopes/skills) scripts check the mechanical
properties — schema, token resolution, contrast maths, SVG portability. They establish
nothing about strategic or aesthetic quality.

```bash
SKILL=path/to/skills/skills/branding-studio/scripts

python3 "$SKILL/validate_structure.py" brand/brand-spec.json
python3 "$SKILL/asset_checks.py" brand/logo/horizontal-color.svg
python3 "$SKILL/color_tools.py" contrast '#559870' '#000000' large
```

`validate_structure.py` reports one standing advisory: the Verde Claro pairing carries a
modest APCA signal. That is expected and explained in `visual.palette.green_light_tradeoff`
— it is not a regression.
