/**
 * Converte modelos Prisma para o formato legado `Series` / `Episode` / `FeaturedBanner` do front.
 */

function categoryLabelsFromMovie(movie) {
  return movie.categories.map((mc) => mc.category.name);
}

function categoryLabelsFromSeries(series) {
  return series.categories.map((sc) => sc.category.name);
}

export function movieToSeriesRow(movie) {
  const labels = categoryLabelsFromMovie(movie);
  return {
    id: movie.id,
    title: movie.title,
    description: movie.description,
    year: movie.year,
    age_rating: movie.rating || '16',
    featured: movie.isFeatured,
    published: movie.isPublished,
    total_views: movie.totalViews,
    cover_url: movie.posterImage,
    banner_url: movie.bannerImage,
    banner_object_position: movie.bannerObjectPosition || '50% center',
    highlighted_home_section: movie.highlightedHomeSection || '',
    categories: labels,
    category: labels.join(', '),
    content_type: 'movie',
    movie_url: movie.movieUrl || '',
    trailer_url: movie.trailerUrl || '',
    slug: movie.slug,
    created_date: movie.createdAt?.toISOString?.() ?? movie.createdAt,
    updated_date: movie.updatedAt?.toISOString?.() ?? movie.updatedAt,
  };
}

export function seriesToSeriesRow(series) {
  const labels = categoryLabelsFromSeries(series);
  return {
    id: series.id,
    title: series.title,
    description: series.description,
    year: series.year,
    age_rating: series.rating || '16',
    featured: series.isFeatured,
    published: series.isPublished,
    total_views: series.totalViews,
    cover_url: series.posterImage,
    banner_url: series.bannerImage,
    banner_object_position: series.bannerObjectPosition || '50% center',
    highlighted_home_section: series.highlightedHomeSection || '',
    categories: labels,
    category: labels.join(', '),
    content_type: 'series',
    movie_url: '',
    slug: series.slug,
    created_date: series.createdAt?.toISOString?.() ?? series.createdAt,
    updated_date: series.updatedAt?.toISOString?.() ?? series.updatedAt,
  };
}

export function episodeToRow(ep) {
  return {
    id: ep.id,
    series_id: ep.seriesId,
    title: ep.title,
    season: ep.seasonNumber,
    number: ep.episodeNumber,
    description: ep.description || '',
    video_url: ep.videoUrl || '',
    duration: ep.duration ?? 0,
    thumbnail_url: ep.thumbnail || '',
    created_date: ep.createdAt?.toISOString?.() ?? ep.createdAt,
    updated_date: ep.updatedAt?.toISOString?.() ?? ep.updatedAt,
  };
}

export function heroToFeaturedBanner(hb) {
  const linkedId = hb.linkedMovieId || hb.linkedSeriesId || '';
  return {
    id: hb.id,
    series_id: linkedId,
    order: hb.sortOrder,
    active: hb.isActive,
    title: hb.title,
    subtitle: hb.subtitle,
    description: hb.description,
    image: hb.image,
    custom_url: hb.customUrl,
  };
}

export function mergeSeriesLists(movies, seriesList) {
  return [...movies.map(movieToSeriesRow), ...seriesList.map(seriesToSeriesRow)];
}
