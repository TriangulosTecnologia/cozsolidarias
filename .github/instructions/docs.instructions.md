---
applyTo: '**/*.md,**/*.mdx'
description: Documentation writing standards.
---

# Documentation Guidelines

## Core Philosophy: Less Is More

Every sentence must earn its place. Prefer removing over adding. Before writing, ask:

- Is this information necessary for the reader to succeed?
- Can this be said in fewer words without losing meaning?
- Would removing this paragraph make the doc less effective?

**When in doubt, cut it out.**

## Before Editing

Check for related content to avoid duplication. Identify existing internal links your changes might break. Never reproduce content that lives elsewhere — link to it.

## Audience

Target audience is technical developers. Write concisely, assume familiarity with standard concepts (REST, JWT, async, etc.). Do not pad with background context that does not help with the immediate task.

## Structure

- Start with context: what the reader will learn or accomplish.
- Use clear, descriptive headings; respect markdown hierarchy.
- Minimize structural breaks — prefer flowing paragraphs over excessive subheadings and bullet lists.
- Cross-reference related docs with relative links.
- Code blocks always declare a language for syntax highlighting.
- Use Mermaid diagrams for processes, flows, architectures, and decision trees instead of long prose.

## When to Use Lists vs Paragraphs

- **Lists**: actionable steps, distinct options, items the reader references individually.
- **Paragraphs**: explanatory content and connected concepts.
- **Tables**: structured comparisons or specifications.

## Internal Links

For docs sources with numeric folder prefixes (used only for ordering), strip the prefixes in links. Use the rendered URL path, not the file path.

## Quality Checklist

- [ ] No redundancy — link to existing docs instead of duplicating.
- [ ] Front matter complete (title, slug/description, tags as applicable).
- [ ] All internal links work.
- [ ] No excessive subheadings or bullet lists where prose would do.
- [ ] Removed anything tangential, historical, or obvious.
