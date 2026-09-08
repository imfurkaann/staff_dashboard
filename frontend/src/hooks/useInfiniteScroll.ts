import { useEffect, useRef } from 'react';

interface InfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore?: () => void;
  enabled?: boolean;
  root?: Element | null;
  rootMargin?: string;
  threshold?: number;
}

/**
 * Observes a sentinel near the end of a server-paginated list.
 * The callback is kept in a ref so re-renders do not recreate the observer.
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  enabled = true,
  root = null,
  rootMargin = '240px 0px',
  threshold = 0,
}: InfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!enabled || !hasMore || isLoading || !loadMoreRef.current) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && loadMoreRef.current) {
        loadMoreRef.current();
      }
    }, { root, rootMargin, threshold });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, hasMore, isLoading, root, rootMargin, threshold]);

  return sentinelRef;
}
