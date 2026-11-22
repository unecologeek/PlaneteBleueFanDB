import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { formatNumberFR } from '../types';
import type { EmissionRecord } from '../types';
import { EmissionOrbitalEmblem } from './EmissionOrbitalEmblem';
import { InfiniteSentinel } from './InfiniteSentinel';

interface EmissionsViewProps {
  years: Array<{ year: number; count: number }>;
  onSelectEmission: (slug: string) => void;
}

export function EmissionsView({ years, onSelectEmission }: EmissionsViewProps) {
  const [q, setQ] = useState('');
  const [year, setYear] = useState<string>('');
  const [items, setItems] = useState<EmissionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const requestSeq = useRef(0);

  const fetchEmissionsPage = useCallback(
    async (targetPage: number, reset: boolean) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (year) params.set('year', year);
        params.set('page', String(targetPage));
        params.set('limit', '24');

        const res = await fetch(`/api/emissions?${params.toString()}`);
        const data = await res.json();
        if (seq !== requestSeq.current) return;

        const nextItems: EmissionRecord[] = data.items ?? [];
        setItems((prev) => (reset ? nextItems : [...prev, ...nextItems]));
        setTotal(data.total ?? 0);
        setPage(targetPage);
        setHasMore(targetPage < (data.totalPages ?? 1));
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      }
    },
    [q, year]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmissionsPage(1, true);
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchEmissionsPage]);

  return (
    <div className="space-y-5">
      <div className="bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#030925]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrer par numéro (ex : 1054), date ou mot-clé…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980] transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            aria-label="Filtrer par année"
            className="px-3 py-2 text-sm bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980]"
          >
            <option value="">Toutes les années</option>
            {years.map((y) => (
              <option key={y.year} value={String(y.year)}>
                {y.year} ({y.count})
              </option>
            ))}
          </select>

          <span className="text-xs font-mono tabular-nums text-[#030925]/65 whitespace-nowrap">
            {formatNumberFR(total)} émission{total > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg overflow-hidden animate-pulse"
            >
              <div className="aspect-[4/3] bg-[#DDD8D0]/60" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-[#DDD8D0]/60 rounded w-1/2" />
                <div className="h-3 bg-[#DDD8D0]/60 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg py-16 px-6 text-center space-y-2">
          <p className="text-sm font-medium text-[#030925]">Aucune émission trouvée</p>
          <p className="text-xs text-[#030925]/65">
            Modifiez votre recherche ou réinitialisez le filtre d’année.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((em) => (
            <button
              key={em.id}
              type="button"
              onClick={() => onSelectEmission(em.slug)}
              className="group text-left bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg overflow-hidden hover:border-[#144980] transition-colors flex flex-col focus-visible:outline-2 focus-visible:outline-[#144980]"
            >
              <div className="aspect-[16/9] w-full overflow-hidden border-b border-[#DDD8D0]">
                <EmissionOrbitalEmblem number={em.number} slug={em.slug} compact />
              </div>

              <div className="p-4 space-y-1.5 flex-1 flex flex-col justify-between w-full">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-[#030925] group-hover:text-[#144980] transition-colors">
                      La Planète Bleue nº {em.number ?? em.slug}
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-[#144980] shrink-0">
                      {em.track_count} titres
                    </span>
                  </div>
                  {em.subtitle && (
                    <p className="text-xs text-[#030925]/70 italic truncate mt-0.5">
                      {em.subtitle}
                    </p>
                  )}
                </div>

                <div className="text-xs text-[#030925]/65 pt-1 flex items-center gap-1.5">
                  <span className="font-mono tabular-nums">
                    {em.broadcast_date_label || em.broadcast_date || 'Date inconnue'}
                  </span>
                  {em.duration_sec && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(em.duration_sec / 60)} min
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <InfiniteSentinel
        hasMore={hasMore}
        loading={loading && items.length > 0}
        onLoadMore={() => fetchEmissionsPage(page + 1, false)}
        loadedCount={items.length}
        totalCount={total}
      />
    </div>
  );
}
