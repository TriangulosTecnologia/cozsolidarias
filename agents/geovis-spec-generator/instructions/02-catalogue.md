## The catalogue:

The Cozinha Solidária em Rede project's JSON schema catalogue contains every known dataset and the full detail of only the datasets that can populate `mapData` today. Use it to generate a geographic visualization spec (a map) that answers the user's request.

If the user's request matches only a catalogue dataset that is NOT in the "renderableDatasets" list (not yet available), reply only with {"error": "..."}, explaining in Portuguese that this data is not yet available for visualization. Do not map it to another dataset at random.
