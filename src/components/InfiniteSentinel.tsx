import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteSentinelProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  scrollRoot?: React.RefObject<HTMLElement | null>;
  loadedCount?: number;
  totalCount?: number;
}

export function InfiniteSentinel({
  hasMore,
  loading,
  onLoadMore,
  scrollRoot,
  loadedCount,
  totalCount,
}: InfiniteSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!hasMore || loading) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMoreRef.current();
        }
      },
      {
        root: scrollRoot?.current ?? null,
        rootMargin: '160px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, scrollRoot]);

  if (!hasMore && !loading) {
    if (loadedCount !== undefined && totalCount !== undefined && totalCount > 0) {
      return (
        <div className="py-3 text-center text-xs font-mono tabular-nums text-[#030925]/55">
          {loadedCount} / {totalCount} affichés
        </div>
      );
    }
    return null;
  }

  return (
    <div ref={sentinelRef} className="py-3.5 flex items-center justify-center gap-3">
      {loading ? (
        <span className="inline-flex items-center gap-2 text-xs text-[#144980]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Chargement…</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={onLoadMore}
          className="text-xs font-medium text-[#144980] hover:text-[#030925] hover:underline px-3 py-1"
        >
          Charger la suite
          {loadedCount !== undefined && totalCount !== undefined && (
            <span className="font-mono tabular-nums text-[#030925]/60 ml-1.5">
              ({loadedCount} / {totalCount})
            </span>
          )}
        </button>
      )}
    </div>
  );
}
