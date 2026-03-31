import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SeriesCard from './SeriesCard';

const PX_PER_SEC = 26;

/**
 * Carrossel horizontal automático para filmes: movimento contínuo, loop por duplicação,
 * pausa em hover / pointer / wheel; scroll manual nativo (arrastar, trackpad, toque).
 */
export default function MovieAutoCarousel({
  title,
  movies = [],
  myListIds,
  onToggleList,
  episodes = [],
  hideComingSoon = false,
  hideComingSoonIds = new Set(),
  browseTo,
  category,
  showHeader = true,
  className = '',
}) {
  const scrollRef = useRef(null);
  const pauseRef = useRef(false);
  const halfRef = useRef(0);
  const visibleRef = useRef(true);
  const rafRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  /** Nº par de blocos idênticos [movies,...] para garantir scrollWidth > clientWidth em ecrãs largos. */
  const [repeatBlocks, setRepeatBlocks] = useState(2);

  const contentKey = movies?.map((m) => m.id).join('|') ?? '';

  const stripItems = useMemo(() => {
    if (!movies?.length) return [];
    return Array.from({ length: repeatBlocks }, () => movies).flat();
  }, [movies, repeatBlocks]);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(
    (ms = 1600) => {
      clearResumeTimer();
      resumeTimerRef.current = setTimeout(() => {
        pauseRef.current = false;
        resumeTimerRef.current = null;
      }, ms);
    },
    [clearResumeTimer]
  );

  const pause = useCallback(() => {
    pauseRef.current = true;
    clearResumeTimer();
  }, [clearResumeTimer]);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const apply = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      halfRef.current = el.scrollWidth > 0 ? el.scrollWidth / 2 : 0;
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      requestAnimationFrame(() => {
        const inner = scrollRef.current;
        if (!inner || !movies?.length) return;
        // Sem overflow horizontal o scrollLeft nunca muda — duplicar até haver margem de scroll.
        if (
          inner.scrollWidth <= inner.clientWidth + 4 &&
          repeatBlocks < 24
        ) {
          setRepeatBlocks((n) => n + 2);
        }
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentKey, movies?.length, repeatBlocks]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const root = el.closest('.movie-auto-carousel');
    if (!root) return;
    const io = new IntersectionObserver(
      ([e]) => {
        // Evita ficar sempre false no 1.º frame (animação nunca arrancava).
        visibleRef.current = e.isIntersecting;
      },
      { threshold: 0, rootMargin: '120px 0px 200px 0px' }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [contentKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || reducedMotion) return;

    pauseRef.current = false;
    let last = performance.now();

    const loop = (now) => {
      const dt = Math.min(now - last, 64);
      last = now;

      const sw = el.scrollWidth;
      const cw = el.clientWidth;
      const half = halfRef.current || (sw > 0 ? sw / 2 : 0);
      // Só animar se existir overflow real (senão scrollLeft fica sempre 0).
      const canScroll = sw > cw + 2 && half > 0;
      if (!pauseRef.current && visibleRef.current && canScroll) {
        el.scrollLeft += (PX_PER_SEC * dt) / 1000;
        if (el.scrollLeft >= half - 0.5) {
          el.scrollLeft -= half;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [contentKey, reducedMotion]);

  useEffect(() => () => clearResumeTimer(), [clearResumeTimer]);

  if (!movies || movies.length === 0) return null;

  const header = showHeader ? (
    <div className="flex items-center justify-between px-4 md:px-12 mb-3 md:mb-4">
      <h2 className="text-lg md:text-xl font-bold">{title}</h2>
      {(browseTo || category) && (
        <Link
          to={browseTo || `/Browse?category=${encodeURIComponent(category)}`}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Ver Todos
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  ) : null;

  return (
    <div className={`movie-auto-carousel relative ${showHeader ? 'mb-0' : ''} ${className}`.trim()}>
      {header}
      <div
        className="px-4 md:px-12 pb-4"
        onMouseEnter={pause}
        onMouseLeave={() => scheduleResume(500)}
      >
        <div
          ref={scrollRef}
          role="region"
          aria-label={title || 'Filmes'}
          className="flex gap-2 md:gap-3 overflow-x-auto hide-scrollbar pb-1 touch-pan-x"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onPointerDown={pause}
          onPointerUp={() => scheduleResume(1800)}
          onPointerCancel={() => scheduleResume(1800)}
          onWheel={() => {
            pause();
            scheduleResume(2800);
          }}
          onTouchStart={pause}
          onTouchEnd={() => scheduleResume(2000)}
        >
          {stripItems.map((s, i) => (
            <div key={`${s.id}-dup-${i}`} className="shrink-0">
              <SeriesCard
                series={s}
                isInList={myListIds?.includes(s.id)}
                onToggleList={onToggleList}
                episodes={episodes}
                hideComingSoon={hideComingSoon || hideComingSoonIds.has(s.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
