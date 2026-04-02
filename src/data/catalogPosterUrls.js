/**
 * Capas externas por id do catálogo (ex.: CDN TMDB: image.tmdb.org/t/p/w500 + poster_path).
 * Opcional: preenche aqui ou define `poster_url` no objeto do filme em `movieCatalog.js`.
 * Para gerar paths a partir do TMDB: `GET /3/movie/{id}` → campo `poster_path`.
 */
/** @type {Record<string, string>} */
export const POSTER_URL_BY_CATALOG_ID = {
  // Exemplo (TMDB id 9552 — O Exorcista): descomenta após confirmar o poster_path na API
  // 'movie-o-exorcista-1974': 'https://image.tmdb.org/t/p/w500/xxxxxxxx.jpg',
};

export function posterUrlForCatalogId(id) {
  if (!id || typeof id !== 'string') return null;
  return POSTER_URL_BY_CATALOG_ID[id] || null;
}
