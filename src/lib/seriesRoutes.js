import { isMovie } from '@/constants/contentType';

/**
 * Slug para URLs /movie/:slug e /series/:slug (compatível com ids legados `movie-*` / `series-*`).
 */
export function getSlugForRoutes(s) {
  if (!s) return null;
  if (s.slug) return s.slug;
  const id = s.id || '';
  if (id.startsWith('movie-')) return id.slice('movie-'.length);
  if (id.startsWith('series-')) return id.slice('series-'.length);
  return null;
}

export function seriesDetailHref(s) {
  const slug = getSlugForRoutes(s);
  if (slug && isMovie(s)) return `/movie/${encodeURIComponent(slug)}`;
  if (slug && !isMovie(s)) return `/series/${encodeURIComponent(slug)}`;
  return `/SeriesDetail?id=${encodeURIComponent(s.id)}`;
}
