// The 10 sample kitchens for the OSM-vs-Google nearby-coverage experiment.
// Hand-picked from src/data-source-static/data/cozinhas_com_geolocalizacao_all.csv
// (columns "Código da Cozinha", "Latitude", "Longitude") to maximise diversity:
// all five Brazilian regions, pairing a capital/large city with a smaller
// interior town per region. This contrast is what should expose the coverage
// gap between OpenStreetMap (weaker in the interior) and Google Places.

/** A single sample kitchen with its centre coordinate. */
export type Kitchen = {
  /** Kitchen code from the source CSV (e.g. `CS015938`). */
  codigo: string;
  municipio: string;
  uf: string;
  /** Brazilian macro-region. */
  regiao: 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';
  /** Rough urban size class, for reading the results. */
  porte: 'capital' | 'large' | 'medium-interior' | 'small-interior';
  latitude: number;
  longitude: number;
};

export const KITCHENS: Kitchen[] = [
  { codigo: 'CS015497', municipio: 'Manaus', uf: 'AM', regiao: 'Norte', porte: 'capital', latitude: -3.14314, longitude: -60.0037 },
  { codigo: 'CS018836', municipio: 'Colinas do Tocantins', uf: 'TO', regiao: 'Norte', porte: 'small-interior', latitude: -8.05467, longitude: -48.49771 },
  { codigo: 'CS016009', municipio: 'Fortaleza', uf: 'CE', regiao: 'Nordeste', porte: 'capital', latitude: -3.7917, longitude: -38.6258 },
  { codigo: 'CS020860', municipio: 'Arcoverde', uf: 'PE', regiao: 'Nordeste', porte: 'small-interior', latitude: -8.42724, longitude: -37.05214 },
  { codigo: 'CS016512', municipio: 'Goiânia', uf: 'GO', regiao: 'Centro-Oeste', porte: 'capital', latitude: -16.71002, longitude: -49.33405 },
  { codigo: 'CS016720', municipio: 'Barra do Garças', uf: 'MT', regiao: 'Centro-Oeste', porte: 'medium-interior', latitude: -15.89371, longitude: -52.25873 },
  { codigo: 'CS015938', municipio: 'São Paulo', uf: 'SP', regiao: 'Sudeste', porte: 'capital', latitude: -23.56657, longitude: -46.64828 },
  { codigo: 'CS014824', municipio: 'Alfenas', uf: 'MG', regiao: 'Sudeste', porte: 'medium-interior', latitude: -21.4198, longitude: -45.97771 },
  { codigo: 'CS014558', municipio: 'Porto Alegre', uf: 'RS', regiao: 'Sul', porte: 'capital', latitude: -30.06995, longitude: -51.22246 },
  { codigo: 'CS015374', municipio: 'Antônio Carlos', uf: 'SC', regiao: 'Sul', porte: 'small-interior', latitude: -27.52316, longitude: -48.80113 },
];
