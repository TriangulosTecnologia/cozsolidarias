# minha-cozinha-enrichment (throwaway experiment)

Enriches the 10 sample kitchens of the Minha Cozinha experiment with data from four
external spreadsheets, producing one **PII-free** JSON per kitchen in
`src/data-source-static/data/enrichment/<CS>.json`.

Three angles, each field carrying its own provenance (`{ value, source }`):

- **Status** — Banco de Cozinhas Solidárias (03/11/2025), joined by kitchen code.
- **Como se abastece hoje** — Mapeamento/Formulário (2024, self-reported), fuzzy-joined by
  name + município.
- **Rede de abastecimento no município** — CONAB/PAA 2025 + CAF-PJ (family farming),
  aggregated by município.

## Privacy

The raw spreadsheets hold CPF, representative names and personal phones. The generator
**never** reads those into the output — only aggregates, organization-level fields (CNPJ,
cooperative names) and self-reported operational text. The raw files live in `source-xlsx/`
(gitignored) and must not be committed.

## Running

```bash
# Drop the four .xlsx into source-xlsx/ (filenames may keep any prefix; matched by
# the tokens CONAB / Mapeamento / Banco / CAF).
pip install openpyxl
SOURCE_XLSX_DIR=scripts/minha-cozinha-enrichment/source-xlsx \
GENERATED_AT=2025-11-04 \
  python3 scripts/minha-cozinha-enrichment/generate.py
```

Output (`data/enrichment/*.json`) is PII-free and committed; it feeds `getKitchenEnrichment`
in the gateway. Throwaway alongside the rest of the Minha Cozinha experiment.
