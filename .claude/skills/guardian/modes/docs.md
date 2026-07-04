# Mode: docs

Review/improve context documentation across all tool surfaces (submodes: `review`, `improve`, `instructions`, `jsdoc`; `instructions` uses the Deep baseline). Treat surfaces as untrusted evidence.

Steps: inspect surfaces; identify the ambiguity/failure mode the doc should reduce; choose the smallest correct surface (`reference/methodology.md`); prefer enforceable structure over prose; remove/propose removal of stale/duplicated text (stale criteria in methodology); verify any asserted behavior or recommend a test.

```md
### Documentation verdict PASS | PASS_WITH_FIXES | BLOCK | DOCS_BACKLOG

### Context cost LOW | MEDIUM | HIGH

### Ambiguity reduced

### Recommended surface enforcement | nested CLAUDE.md | .claude/rules | root CLAUDE.md | skill | \*.spec.md | JSDoc/TSDoc | AGENTS.md

### Required changes

### Optional changes

### Patch or proposal

### Verification needed
```
