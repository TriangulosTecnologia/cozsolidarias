# Run 20261124T135313Z--task_03gfmj3z8j-cadunico-base-dinamica

CadÚnico cases against the local dev server (real `POST`, no mock) after D-src = b: the
rate base lives in the id (`cozinhas_por_<N>mil_cadunico`), and the base a prompt names
renames the served id before the data is fetched.

- `cases/<id>.json`: full response; `specs/<id>.spec.json`: the served spec.
- `cases/<id>.score.json`, `eval-report.json`, `SUMMARY.md`: 5/5 pass.
- `cases/<id>.gate.json`: `gate_ratio.mjs` passes on all 5 (independent oracle, 348 municípios).

| Case | Prompt base | Served id | Salvador | Legend `normalization.rateBase` |
| --- | --- | --- | --- | --- |
| ratio-cozinhas-cadunico-10mil | 10 mil | cozinhas_por_10mil_cadunico | 0.23 | 10000 |
| ratio-cozinhas-cadunico-100mil | 100 mil | cozinhas_por_100mil_cadunico | 2.33 | 100000 |
| ratio-cozinhas-cadunico-50mil | 50 mil | cozinhas_por_50mil_cadunico | 1.17 | 50000 |
| ratio-cozinhas-cadunico-50k | 50k | cozinhas_por_50mil_cadunico | 1.17 | 50000 |
| ratio-pessoas-cadunico-por-cozinha | — | cadunico_pessoas_por_cozinha | 42881 | — |
