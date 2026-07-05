# UI Components (`src/**/*.tsx`)

Covers everything that renders: Chakra UI, layout, accessibility, map runtime.
For data loading and gateway calls → see `src/app/CLAUDE.md`.
For project-wide constraints → see root `CLAUDE.md`.

## Component Hierarchy

- `src/components/ui/` — generic Chakra primitives with no domain knowledge.
- `src/components/<feature>/` — domain components (e.g. `map/`, `indicators/`).
- Route-specific: co-locate in `src/app/<route>/_components/`.
- 3× rule: extract to a shared module only after 3 uses.

## Server vs. Client

No `"use client"` unless the component uses state, effects, browser APIs, event handlers, or the map runtime. Prefer Server Components for structural layout and static content.

## Styling

Chakra v3 props and design tokens only. No `className`, no inline `style`, no CSS files.
Default to neutral — apply `colorPalette` only when it carries meaning.
Use `Stack` / `HStack` / `VStack` + `gap` for spacing. No margin tricks.

## Lean on Chakra

- Compose compound parts in place (`Card.Root`/`Body`, `Field.Root`/`Label`/`ErrorText`). Don't wrap them just to rename.
- Use `asChild` to merge with `next/link` or custom triggers instead of nesting.
- Vary appearance via `variant` / `size` / `colorPalette` props — don't fork a component for visual changes.
- Use semantic tokens (`bg.subtle`, `fg.default`, `border.subtle`) for theme-aware colours; raw palette values only when a specific colour is intentional and must not shift with colour mode.

## Accessibility

- `aria-label` on icon-only controls.
- Keyboard navigation works (Tab / Shift+Tab / Enter / Esc).
- Don't disable the focus ring.
- Meaningful `alt` text on images (`alt=""` for decorative).
- Semantic heading hierarchy (`h1`–`h6`); don't skip levels.
- For `onClick` on a `Box`, use `as="button"` or a real `<button>` so keyboard navigation works.

## Chakra UI v3 Reference

For building with Chakra UI v3 (layouts, forms, tokens, responsive styles, recipes, charts, theming), use the `chakra-ui-builder` skill before building.
