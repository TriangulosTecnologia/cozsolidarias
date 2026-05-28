---
applyTo: 'src/**/*.tsx'
---

# UI components in `src/`

**Scope:** anything that renders — Chakra UI, layout, accessibility, map runtime.
For data loading, route handlers, and gateway calls → see [`app.instructions.md`](./app.instructions.md).
For project-wide constraints → see [`copilot-instructions.md`](../copilot-instructions.md).

## Component hierarchy

- `src/components/ui/` — generic Chakra primitives with no domain knowledge.
- `src/components/<feature>/` — domain components (e.g. `map/`, `indicators/`).
- Route-specific: co-locate in `src/app/<route>/_components/`.
- **3× rule:** extract to shared module only after 3 uses.

## Server vs. Client

No `"use client"` unless the component uses state, effects, browser APIs, event handlers, or the map runtime.
Prefer Server Components for structural layout and static content.

## Styling

Chakra v3 props and tokens only. No `className`, no inline `style`, no CSS files.
Default to neutral — apply `colorPalette` only when it carries meaning.
Use `Stack` / `HStack` / `VStack` + `gap` for spacing. No margin tricks.

## Lean on Chakra

- Compose compound parts in place (`Card.Root`/`Body`, `Field.Root`/`Label`/`ErrorText`).
  Don't wrap them just to rename.
- Use `asChild` to merge with `next/link` or custom triggers instead of nesting.
- Vary appearance via `variant` / `size` / `colorPalette` props — don't fork a component for visual changes.

## Accessibility

- `aria-label` on icon-only controls.
- Keyboard navigation works (Tab / Shift+Tab / Enter / Esc).
- Don't disable focus ring.
