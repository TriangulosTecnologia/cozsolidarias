---
description: 'Detect hardcoded JSX strings, extract, translate missing pt-BR, recompile'
agent: 'agent'
---

Bring the app to a state with zero hardcoded user-facing strings and zero missing pt-BR translations.

## Step 1 — Detect hardcoded JSX strings

Run from the repository root:

```
pnpm eslint src/ 2>&1 | grep -E "^/|formatjs/no-literal-string-in-jsx"
```

For every `formatjs/no-literal-string-in-jsx` warning, replace the hardcoded JSX text with `intl.formatMessage({ defaultMessage, description })` per [i18n.instructions.md](../instructions/i18n.instructions.md). If there are no such warnings, skip to Step 2.

## Step 2 — Extract

```
pnpm run i18n
```

Run from the repository root. This updates `i18n/lang/en.json`, `i18n/missing/pt-BR.json`, and `i18n/compiled/`.

## Step 3 — Translate missing pt-BR entries

Read [i18n/missing/pt-BR.json](../../i18n/missing/pt-BR.json).

- If it is `{}`, stop.
- Otherwise, for each key, append an entry to [i18n/lang/pt-BR.json](../../i18n/lang/pt-BR.json) with the same key, the `description` copied verbatim, and `defaultMessage` translated to natural Brazilian Portuguese. Keep proper nouns, acronyms (FAPESP), brand names, and technical terms (Cookies) unchanged.

## Step 4 — Recompile and verify

```
pnpm run i18n
```

Confirm `i18n/missing/pt-BR.json` is now `{}`. If entries remain, fix and rerun.
