# cozsolidarias

## Brand

Public assets live in `public/marca/`, served at `/marca`. The contract lives in `brand/`, which
is not served.

- [`brand-book.html`](public/marca/brand-book.html) — the manual: how the system works and how
  to make new pieces with it. Read it in a browser; printing gives an A4 PDF.
- [`brand-spec.json`](brand/brand-spec.json) — the contract. Colour values, type, tokens
  and the decisions behind them. Single source of truth; do not copy values into a second file.
  It carries positioning and audience exclusions, so it stays outside `public/` and is never
  linked from the manual.

Asset filenames are English kebab-case: they are design artifacts handled by designers and
vendors, not source modules, so the repository's camelCase rule does not apply to them.

## Geodados - municípios brasileiros

o geojson dos municípios brasileiros obtidos de https://github.com/tbrugz/geodata-br
com fonte IBGE e simplificado com aproximadamente 24% dos pontos originais.
