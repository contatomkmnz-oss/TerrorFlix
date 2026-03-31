import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { isMovie } from '@/constants/contentType';
import { getItemsForNetflixRow } from '@/lib/netflixHomeRows';
import { useShuffledMovies } from '@/hooks/useShuffledMovies';
import MovieAutoCarousel from './MovieAutoCarousel';
import SeriesCarousel from './SeriesCarousel';

/**
 * Uma fileira Netflix: filmes (carrossel automático + ordem aleatória) e séries (carrossel manual), mesmo título.
 */
export default function NetflixHomeRow({
  slug,
  label,
  visibleSeries,
  myListIds,
  onToggleList,
  episodes,
  hideComingSoon,
  hideComingSoonIds,
}) {
  const location = useLocation();
  const list = useMemo(
    () => getItemsForNetflixRow(visibleSeries, label),
    [visibleSeries, label]
  );
  const movies = useMemo(() => list.filter(isMovie), [list]);
  const seriesRow = useMemo(() => list.filter((s) => !isMovie(s)), [list]);
  const shuffledMovies = useShuffledMovies(movies, location.key);

  if (list.length === 0) return null;

  const header = (
    <div className="flex items-center justify-between px-4 md:px-12 mb-3 md:mb-4">
      <h2 className="text-lg md:text-xl font-bold">{label}</h2>
      <Link
        to={`/Browse?section=${encodeURIComponent(slug)}`}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
      >
        Ver Todos
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );

  return (
    <div className="mb-8 md:mb-12">
      {header}
      <div
        className={
          movies.length > 0 && seriesRow.length > 0 ? 'space-y-4' : ''
        }
      >
        {movies.length > 0 && (
          <MovieAutoCarousel
            key={`mrow-${slug}-${movies.map((m) => m.id).sort().join(',')}`}
            showHeader={false}
            title={label}
            movies={shuffledMovies}
            myListIds={myListIds}
            onToggleList={onToggleList}
            episodes={episodes}
            hideComingSoon={hideComingSoon}
            hideComingSoonIds={hideComingSoonIds}
          />
        )}
        {seriesRow.length > 0 && (
          <SeriesCarousel
            showHeader={false}
            title={label}
            series={seriesRow}
            myListIds={myListIds}
            onToggleList={onToggleList}
            browseTo={`/Browse?section=${encodeURIComponent(slug)}`}
            episodes={episodes}
            hideComingSoon={hideComingSoon}
            hideComingSoonIds={hideComingSoonIds}
            className="!mb-0"
          />
        )}
      </div>
    </div>
  );
}
