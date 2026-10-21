import { setWorkerUrl } from 'maplibre-gl';

// Bundled `maplibre-gl` derives its worker URL from its own (webpack-internal)
// module URL, which a Worker cannot load. The literal `new URL(…, import.meta.url)`
// makes webpack emit the worker as an asset and return its served URL.
setWorkerUrl(
  new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href
);
