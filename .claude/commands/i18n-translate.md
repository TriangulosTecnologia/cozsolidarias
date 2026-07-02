Bring the app to a state with zero hardcoded user-facing strings and zero missing pt-BR translations.

## Step 1 — Detect hardcoded JSX strings

Run from the repository root:

```bash
pnpm eslint src/ 2>&1 | grep -E "^/|formatjs/no-literal-string-in-jsx"
```

For every `formatjs/no-literal-string-in-jsx` warning, replace the hardcoded JSX text with `intl.formatMessage({ defaultMessage, description })`. If there are no such warnings, proceed to Step 2.

## Step 2 — Extract

```bash
pnpm run i18n
```

This updates `i18n/lang/en.json`, `i18n/missing/pt-BR.json`, and `i18n/compiled/`.

## Step 3 — Translate missing pt-BR entries

Read `i18n/missing/pt-BR.json`.

- If it is `{}`, stop here.
- Otherwise, for each key append an entry to `i18n/lang/pt-BR.json` with the same key, the `description` copied verbatim, and `defaultMessage` translated to natural Brazilian Portuguese. Keep proper nouns, acronyms (FAPESP), brand names, and technical terms (Cookies) unchanged.

## Step 4 — Recompile and verify

```bash
pnpm run i18n
```

Confirm `i18n/missing/pt-BR.json` is now `{}`. If entries remain, fix and rerun.
