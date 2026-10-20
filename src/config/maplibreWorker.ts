import { setWorkerUrl } from 'maplibre-gl';

// Bundled `maplibre-gl` derives its worker URL from its own (webpack-internal)
// module URL, which a Worker cannot load. Serve the worker from `public/`.
setWorkerUrl('/maplibre-gl-worker.mjs');
