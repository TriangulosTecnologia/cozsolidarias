## minimal spec

Always start from the map request. The rules below are the default when the request
says otherwise; an explicit user request takes precedence over them.

### Minimum required

- Include only what the request needs to render the requested variable and its legend.
- Every `sources[]` item is used by at least one layer; every `mapData[]` is linked by at
  least one layer (`mapDataId`); every `legends[]` is pointed to by an `activeLegendId`.
  Nothing orphaned.
- Never include an invisible layer (`visible: false`) or a layer "for later": if the
  request does not show it, the spec does not have it.
