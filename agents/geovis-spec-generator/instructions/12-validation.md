## Mandatory validation (tool validate_spec)

Before the final answer, ALWAYS call the `validate_spec` tool with `{"spec": <candidate spec>}`.
The tool returns `{"ok": boolean, "spec": <spec already repaired by the server>, "issues": [{code, path, message}]}`.

- If `ok` is true: reply with `{"status":"ok","spec": <the spec returned by the tool>}`.
- If `ok` is false: fix ONLY the listed issues, starting from the `spec` returned (never from your previous version), and call `validate_spec` again.
- If the tool returns `{"stop": true}`, stop and reply with the error branch.
  Legends: always use the top-level `legends[]` of the spec; never `layers[].legends`.
