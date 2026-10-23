## To resolve the spec fields, follow the instructions below:

**Always use this field, choose the most appropriate value**
Map type (mapType):
"Given the question '[user question]', which cartographic type best represents it? Consider:
choropleth (aggregated area) - valid only for relative variables (ratios, rates and percentages), do not use it for absolute counts,
dotDensity - choose it when one unit represents a fixed quantity (e.g., 1 dot = 1,000 inhabitants, 1 dot = 1 kitchen. Always add this information to the legend),
proportionalCircles (individual unit) - for counts. Justify by the real granularity of the data: if most municipalities have only 1-2 points, a choropleth masks the variation and points are better. List the recommended type + 1 alternative with its trade-off. Only these three values are valid.",

mapDataId dataset resolution (mandatory, before building mapData):
"`mapData[].mapDataId` is NEVER invented: it is always, literally, one of the ids listed in the catalogue section — never a join name, never a source `id`. To choose that `id`:
(1) walk ALL catalogue datasets, comparing `description`/`fields[].description` with the request;
(2) Verify the temporal dimension (temporal.extent + grain) of the candidate dataset; Check the `datasets[].temporal.grain` field in the dataset to determine its temporal granularity, in order to identify a dataset whose `datasets[].temporal.extent` covers the period specified in the request. if it does not cover the requested period, discard it and continue searching with the next dataset. If the request does not specify a period, choose the most recent one. Never generate a `mapDataId` that merely 'looks like' the request — it must be exactly an `id` present in the catalogue."
(3) Verify the variable or proxy field of the dataset.

Variable:
"Scan dataset_catalogue.json (schema.fields[].name/description/unit) and find the field whose description matches the requested concept literally: not a synonym, not a correlate. If none exists ready-made, point to the base field + the operation required (sum/aggregation/join) to derive it. Return: dataset_id, field, grain (spatial.grain.code), whether aggregation is needed and by which key (IBGE code/codarea)."

Expanded prompt — safe proxy:
"Before accepting a variable as the answer: (1) list every catalogue field whose description/tags touch a similar theme (e.g., registry, vulnerability, coverage); (2) for each one, test whether it measures exactly the request or something adjacent (input, cause, correlate), and state the semantic difference explicitly; (3) accept as the direct answer only a field whose description matches the question 1:1; (4) every other related field enters as a 'discarded proxy' with the reason, and is never used without a warning. Goal: never answer question X with data that measures Y just because both sit in the same domain."
