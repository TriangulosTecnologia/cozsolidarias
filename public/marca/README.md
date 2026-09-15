# marca

Canonical brand package for **Cozinha Solidária em Rede**. Everything downstream — the
site, decks, print, partner materials — should resolve here rather than to a copy.

It sits in `public/` so the app serves it without a second copy: `/marca` redirects to the
brand book, and every master is reachable at the path it has here — `/marca/logo/…`. Edit
the files in place; there is nothing to build or sync.

| File                                   | What it is                                                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`brand-book.html`](./brand-book.html) | The teaching document: why the system behaves as it does and how to apply it. Read this first, in a browser. Printing it from there gives an A4 PDF. |
| [`brand-spec.json`](./brand-spec.json) | The operating contract (Branding Studio schema v4). The single source of truth for values.                                                           |
| [`logo/`](./logo)                      | 24 signature masters (4 lockups × 6 variants) plus 2 badges.                                                                                         |
| [`illustration/`](./illustration)      | 34 drawn food illustrations. 23 from the native source, 11 redrawn from small raster exports, so their interior detail is coarser (`E-015`).         |
| [`pattern/`](./pattern)                | Seamless food pattern tile, in two inks.                                                                                                             |
| [`reference/`](./reference)            | Five rendered applications, one PNG each.                                                                                                            |

## Picking an asset

Logo files are named `<lockup>-<variant>.svg` — `vertical` (primary), `horizontal`,
`stacked`, `wordmark`, `badge-pot` or `badge-csr`, each in `color`, `color-on-dark`,
`white`, `black`, `red` and `green`.

Choose the variant by the ground, never by preference:

| Ground                              | Variant                   |
| ----------------------------------- | ------------------------- |
| Branco Leitura, paper, pale imagery | `color`                   |
| Preto or neutral dark               | `color-on-dark`           |
| **Vermelho or Verde**               | **`white`**               |
| Single-ink production               | `black`, `red` or `green` |

Below the minimum width — 110 px for `horizontal`, 70 px for the others — switch to
`badge-pot` instead of scaling the signature down further.

## Making something new

Three rules cover most of it; the [brand book](./brand-book.html) covers the rest.

1. **Split the surface into voz and mesa.** Voz is a flat brand colour and carries the
   signature and the headline. Mesa is Branco Leitura and carries the food, the data and
   the body text. Illustrations go on mesa, never on a saturated ground.
2. **Set everything in Libre Franklin.** Weight carries the hierarchy; Light only at 18px
   and above.
3. **Name the actor.** Write who does what, let numbers carry the argument, and never use
   the charity register — no _beneficiários_, no _doação_.

## Provenance

The mark, lettering, illustrations and pattern come from the identity delivered by LM&Co.
in June 2026, extracted as vector from its native Adobe Illustrator source
(`MANUAL DE IDENTIDADE VISUAL - COZINHA SOLIDÁRIA.ai`, 2026-06-23). Eleven illustrations
had no usable vector there and were redrawn from the delivered PNG exports (`E-015`).
Every file is plain `<path>` geometry with a `viewBox` — no embedded images, no external
references, no script, no font dependency — so it travels anywhere and exports to PDF.

The system around them — typography, the voz/mesa composition grammar, voice and the
partner signature — was designed on top of that handoff, which resolved the signature but
not what to do with it.

Four decisions deliberately depart from the 2026 manual, each recorded as evidence in the
spec and argued in the brand book: the brand red (`E-001`), the green used for _Em Rede_
on dark grounds (`E-002`), the typeface (`E-010`), and the white lockup on saturated
grounds (`E-009`). Read those before "correcting" any of them back.

## Conventions

Asset filenames are English kebab-case: they are design artifacts handled by designers and
vendors, not source modules, so the repository's camelCase rule does not apply to them.
SVG `<title>` text is pt-BR because screen readers announce it to the people who read the
brand's own materials, and the brand book is pt-BR for the same reason: it is a touchpoint
the kitchens, designers and partners read, not developer documentation. Everything else
here follows the repository's English rule.

This folder is derived from the brand handoff alone. Nothing here is decided by, or
documents, anything elsewhere in the repository.

Colour values live in `brand-spec.json` under `visual.tokens` and are deliberately not
duplicated into a second tokens file. Two copies of a palette drift apart, and the red
recorded in `E-001` is what that looks like when it happens. For the same reason the brand
book shows the masters themselves, by relative path: replace an SVG and the book shows the
new one. Only the typeface is embedded, so the document still reads offline.

## Verifying a change

The [Branding Studio](https://github.com/enniolopes/skills) scripts check the mechanical
properties — schema, token resolution, contrast maths, SVG portability — and nothing about
strategic or aesthetic quality.

```bash
SKILL=.claude/skills/branding-studio/scripts

python3 "$SKILL/validate_structure.py" public/marca/brand-spec.json
python3 "$SKILL/asset_checks.py" public/marca/logo/horizontal-color.svg
python3 "$SKILL/color_tools.py" contrast '#559870' '#000000' large
```

`validate_structure.py` reports one standing advisory: the Verde Claro pairing carries a
modest APCA signal. That is expected and explained in `visual.palette.green_light_tradeoff`
— it is not a regression.
