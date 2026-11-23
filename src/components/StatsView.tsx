import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, RefreshCw, Search } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatDuration } from '../types';
import type { ArchiveStats } from '../types';
import { InfiniteSentinel } from './InfiniteSentinel';

interface StatsViewProps {
  stats: ArchiveStats;
  onFilterByAuthor: (author: string) => void;
  onFilterByCountry: (country: string) => void;
  onFilterByYear: (year: number) => void;
  onFilterByTrack: (query: string) => void;
  onEnrichBatch: () => void;
}

interface AuthorRankItem {
  author: string;
  unique_tracks: number;
  emission_count: number;
  play_count: number;
}

interface CountryRankItem {
  country: string;
  count: number;
}

interface TopTrackRankItem {
  id: number;
  title: string;
  author: string;
  duration_sec: number | null;
  country: string | null;
  emission_count: number;
  play_count: number;
}

interface YearRankItem {
  year: number;
  count: number;
  track_plays: number;
}

export function StatsView({
  stats,
  onFilterByAuthor,
  onFilterByCountry,
  onFilterByYear,
  onFilterByTrack,
  onEnrichBatch,
}: StatsViewProps) {
  const { t, formatNum } = useI18n();
  const durationPct =
    stats.tracks_count > 0
      ? Math.round((stats.tracks_with_duration / stats.tracks_count) * 100)
      : 0;

  // 1. Authors infinite ranking
  const authorsScrollRef = useRef<HTMLDivElement | null>(null);
  const [authorQuery, setAuthorQuery] = useState('');
  const [authors, setAuthors] = useState<AuthorRankItem[]>([]);
  const [authorsTotal, setAuthorsTotal] = useState(0);
  const [authorsHasMore, setAuthorsHasMore] = useState(true);
  const [authorsLoading, setAuthorsLoading] = useState(false);

  const loadAuthors = useCallback(
    async (offset: number, reset: boolean) => {
      setAuthorsLoading(true);
      try {
        const params = new URLSearchParams({ offset: String(offset), limit: '25' });
        if (authorQuery.trim()) params.set('q', authorQuery.trim());
        const res = await fetch(`/api/stats/authors?${params.toString()}`);
        const data = await res.json();
        setAuthors((prev) => (reset ? data.items : [...prev, ...data.items]));
        setAuthorsTotal(data.total ?? 0);
        setAuthorsHasMore(Boolean(data.hasMore));
      } finally {
        setAuthorsLoading(false);
      }
    },
    [authorQuery]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAuthors(0, true);
    }, 180);
    return () => clearTimeout(timer);
  }, [loadAuthors]);

  // 2. Countries infinite ranking
  const countriesScrollRef = useRef<HTMLDivElement | null>(null);
  const [countryQuery, setCountryQuery] = useState('');
  const [countries, setCountries] = useState<CountryRankItem[]>([]);
  const [countriesTotal, setCountriesTotal] = useState(0);
  const [countriesHasMore, setCountriesHasMore] = useState(true);
  const [countriesLoading, setCountriesLoading] = useState(false);

  const loadCountries = useCallback(
    async (offset: number, reset: boolean) => {
      setCountriesLoading(true);
      try {
        const params = new URLSearchParams({ offset: String(offset), limit: '25' });
        if (countryQuery.trim()) params.set('q', countryQuery.trim());
        const res = await fetch(`/api/stats/countries?${params.toString()}`);
        const data = await res.json();
        setCountries((prev) => (reset ? data.items : [...prev, ...data.items]));
        setCountriesTotal(data.total ?? 0);
        setCountriesHasMore(Boolean(data.hasMore));
      } finally {
        setCountriesLoading(false);
      }
    },
    [countryQuery]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCountries(0, true);
    }, 180);
    return () => clearTimeout(timer);
  }, [loadCountries]);

  // 3. Top Tracks infinite ranking
  const topTracksScrollRef = useRef<HTMLDivElement | null>(null);
  const [topTracks, setTopTracks] = useState<TopTrackRankItem[]>([]);
  const [topTracksTotal, setTopTracksTotal] = useState(0);
  const [topTracksHasMore, setTopTracksHasMore] = useState(true);
  const [topTracksLoading, setTopTracksLoading] = useState(false);

  const loadTopTracks = useCallback(async (offset: number, reset: boolean) => {
    setTopTracksLoading(true);
    try {
      const res = await fetch(`/api/stats/top-tracks?offset=${offset}&limit=25`);
      const data = await res.json();
      setTopTracks((prev) => (reset ? data.items : [...prev, ...data.items]));
      setTopTracksTotal(data.total ?? 0);
      setTopTracksHasMore(Boolean(data.hasMore));
    } finally {
      setTopTracksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopTracks(0, true);
  }, [loadTopTracks]);

  // 4. Years infinite ranking
  const yearsScrollRef = useRef<HTMLDivElement | null>(null);
  const [yearsList, setYearsList] = useState<YearRankItem[]>([]);
  const [yearsTotal, setYearsTotal] = useState(0);
  const [yearsMaxCount, setYearsMaxCount] = useState(1);
  const [yearsHasMore, setYearsHasMore] = useState(true);
  const [yearsLoading, setYearsLoading] = useState(false);

  const loadYears = useCallback(async (offset: number, reset: boolean) => {
    setYearsLoading(true);
    try {
      const res = await fetch(`/api/stats/years?offset=${offset}&limit=15`);
      const data = await res.json();
      setYearsList((prev) => (reset ? data.items : [...prev, ...data.items]));
      setYearsTotal(data.total ?? 0);
      setYearsMaxCount(data.maxCount ?? 1);
      setYearsHasMore(Boolean(data.hasMore));
    } finally {
      setYearsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadYears(0, true);
  }, [loadYears]);

  return (
    <div className="space-y-6">
      {/* Duration enrichment bar */}
      <div className="bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-base font-semibold text-[#030925]">
            {t.statsView.coverageTitle}
          </h3>
          <p className="text-sm text-[#030925]/75">
            {t.statsView.coverageDesc}
          </p>
          <p className="text-xs font-mono tabular-nums text-[#144980] pt-1">
            {formatNum(stats.tracks_with_duration)} / {formatNum(stats.tracks_count)}{' '}
            {t.statsView.coverageCountSuffix} ({durationPct}%)
          </p>
        </div>

        <button
          type="button"
          disabled={stats.syncStatus.running}
          onClick={onEnrichBatch}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-[#FAF8F5] bg-[#144980] hover:bg-[#030925] rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {stats.syncStatus.running && stats.syncStatus.mode === 'enrich' ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Clock className="w-3.5 h-3.5" />
          )}
          <span>{t.statsView.enrichBtn}</span>
        </button>
      </div>

      {/* Mobile quick-jump bar (non-sticky) */}
      <div className="lg:hidden grid grid-cols-4 gap-1.5" aria-label={t.statsView.quickJumpAria}>
        <a
          href="#stats-authors"
          className="min-h-[40px] flex items-center justify-center px-2 py-1.5 rounded-md bg-[#FAF8F5] border border-[#DDD8D0] text-xs font-display font-semibold text-[#030925] hover:border-[#144980] text-center"
        >
          {t.statsView.jumpAuthors}
        </a>
        <a
          href="#stats-top-tracks"
          className="min-h-[40px] flex items-center justify-center px-2 py-1.5 rounded-md bg-[#FAF8F5] border border-[#DDD8D0] text-xs font-display font-semibold text-[#030925] hover:border-[#144980] text-center"
        >
          {t.statsView.jumpTracks}
        </a>
        <a
          href="#stats-countries"
          className="min-h-[40px] flex items-center justify-center px-2 py-1.5 rounded-md bg-[#FAF8F5] border border-[#DDD8D0] text-xs font-display font-semibold text-[#030925] hover:border-[#144980] text-center"
        >
          {t.statsView.jumpCountries}
        </a>
        <a
          href="#stats-years"
          className="min-h-[40px] flex items-center justify-center px-2 py-1.5 rounded-md bg-[#FAF8F5] border border-[#DDD8D0] text-xs font-display font-semibold text-[#030925] hover:border-[#144980] text-center"
        >
          {t.statsView.jumpYears}
        </a>
      </div>

      {/* 2x2 Grid of Infinite-Scroll Ranking Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Panel 1: Auteurs les plus diffusés */}
        <div
          id="stats-authors"
          className="scroll-mt-16 bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg flex flex-col overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#DDD8D0] bg-[#ECE8E1]/50 space-y-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-[#030925]">
                {t.statsView.authorsTitle}
              </h3>
              <span className="text-xs font-mono tabular-nums text-[#030925]/65">
                {formatNum(authors.length)} / {formatNum(authorsTotal)}
              </span>
            </div>
            <div className="relative">
              <Search className="w-4 sm:w-3.5 h-4 sm:h-3.5 text-[#030925]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={authorQuery}
                onChange={(e) => setAuthorQuery(e.target.value)}
                placeholder={t.statsView.authorsPlaceholder}
                className="w-full pl-9 sm:pl-8 pr-3 py-2 sm:py-1.5 text-base sm:text-xs bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980]"
              />
            </div>
          </div>

          <div
            ref={authorsScrollRef}
            className="h-[340px] sm:h-[440px] overflow-y-auto overscroll-contain px-4 sm:px-5 divide-y divide-[#DDD8D0]/60"
          >
            {authors.map((a, idx) => (
              <button
                key={`${a.author}-${idx}`}
                type="button"
                onClick={() => onFilterByAuthor(a.author)}
                className="w-full min-h-[44px] py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#ECE8E1]/60 px-2 -mx-2 rounded transition-colors"
              >
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="text-xs font-mono tabular-nums text-[#144980]/70 w-8 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-semibold text-[#030925] truncate">{a.author}</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#030925]/70 shrink-0">
                  {formatNum(a.play_count)} {t.statsView.playsAbbr} · {formatNum(a.emission_count)}{' '}
                  {t.statsView.emissionsAbbr}
                </span>
              </button>
            ))}

            <InfiniteSentinel
              hasMore={authorsHasMore}
              loading={authorsLoading}
              onLoadMore={() => loadAuthors(authors.length, false)}
              scrollRoot={authorsScrollRef}
              loadedCount={authors.length}
              totalCount={authorsTotal}
            />
          </div>
        </div>

        {/* Panel 2: Titres les plus diffusés */}
        <div
          id="stats-top-tracks"
          className="scroll-mt-16 bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg flex flex-col overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#DDD8D0] bg-[#ECE8E1]/50 flex items-baseline justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-[#030925]">
                {t.statsView.topTracksTitle}
              </h3>
              <p className="text-xs text-[#030925]/65 mt-0.5">
                {t.statsView.topTracksSub}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#030925]/65 shrink-0">
              {formatNum(topTracks.length)} / {formatNum(topTracksTotal)}
            </span>
          </div>

          <div
            ref={topTracksScrollRef}
            className="h-[340px] sm:h-[468px] overflow-y-auto overscroll-contain px-4 sm:px-5 divide-y divide-[#DDD8D0]/60"
          >
            {topTracks.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilterByTrack(`${item.author} ${item.title}`)}
                className="w-full min-h-[44px] py-2.5 flex items-start justify-between gap-3 text-left hover:bg-[#ECE8E1]/60 px-2 -mx-2 rounded transition-colors"
              >
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="text-xs font-mono tabular-nums text-[#144980]/70 w-8 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#030925] truncate">{item.title}</div>
                    <div className="text-xs text-[#030925]/65 truncate">
                      {item.author}
                      {item.country ? ` · ${item.country}` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono tabular-nums font-medium text-[#144980]">
                    {formatNum(item.emission_count)} {t.statsView.emissionsAbbr}
                  </div>
                  {item.duration_sec && (
                    <div className="text-[11px] font-mono tabular-nums text-[#030925]/55">
                      {formatDuration(item.duration_sec)}
                    </div>
                  )}
                </div>
              </button>
            ))}

            <InfiniteSentinel
              hasMore={topTracksHasMore}
              loading={topTracksLoading}
              onLoadMore={() => loadTopTracks(topTracks.length, false)}
              scrollRoot={topTracksScrollRef}
              loadedCount={topTracks.length}
              totalCount={topTracksTotal}
            />
          </div>
        </div>

        {/* Panel 3: Origines géographiques */}
        <div
          id="stats-countries"
          className="scroll-mt-16 bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg flex flex-col overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#DDD8D0] bg-[#ECE8E1]/50 space-y-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-[#030925]">
                {t.statsView.countriesTitle}
              </h3>
              <span className="text-xs font-mono tabular-nums text-[#030925]/65">
                {formatNum(countries.length)} / {formatNum(countriesTotal)}
              </span>
            </div>
            <div className="relative">
              <Search className="w-4 sm:w-3.5 h-4 sm:h-3.5 text-[#030925]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder={t.statsView.countriesPlaceholder}
                className="w-full pl-9 sm:pl-8 pr-3 py-2 sm:py-1.5 text-base sm:text-xs bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980]"
              />
            </div>
          </div>

          <div
            ref={countriesScrollRef}
            className="h-[340px] sm:h-[420px] overflow-y-auto overscroll-contain px-4 sm:px-5 divide-y divide-[#DDD8D0]/60"
          >
            {countries.map((c, idx) => (
              <button
                key={`${c.country}-${idx}`}
                type="button"
                onClick={() => onFilterByCountry(c.country)}
                className="w-full min-h-[44px] py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#ECE8E1]/60 px-2 -mx-2 rounded transition-colors"
              >
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="text-xs font-mono tabular-nums text-[#144980]/70 w-8 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-semibold text-[#030925] truncate">{c.country}</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#030925]/70 shrink-0">
                  {formatNum(c.count)} {t.statsView.tracksUnit}
                </span>
              </button>
            ))}

            <InfiniteSentinel
              hasMore={countriesHasMore}
              loading={countriesLoading}
              onLoadMore={() => loadCountries(countries.length, false)}
              scrollRoot={countriesScrollRef}
              loadedCount={countries.length}
              totalCount={countriesTotal}
            />
          </div>
        </div>

        {/* Panel 4: Émissions par année */}
        <div
          id="stats-years"
          className="scroll-mt-16 bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg flex flex-col overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#DDD8D0] bg-[#ECE8E1]/50 flex items-baseline justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-[#030925]">
                {t.statsView.yearsTitle}
              </h3>
              <p className="text-xs text-[#030925]/65 mt-0.5">
                {t.statsView.yearsSub}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#030925]/65 shrink-0">
              {formatNum(yearsList.length)} / {formatNum(yearsTotal)}
            </span>
          </div>

          <div
            ref={yearsScrollRef}
            className="h-[340px] sm:h-[468px] overflow-y-auto overscroll-contain px-4 sm:px-5 py-2 space-y-1"
          >
            {yearsList.map((y) => {
              const pct = Math.max(4, Math.round((y.count / yearsMaxCount) * 100));
              return (
                <button
                  key={y.year}
                  type="button"
                  onClick={() => onFilterByYear(y.year)}
                  className="w-full min-h-[44px] flex items-center gap-2 sm:gap-3 py-2 px-2 -mx-2 rounded hover:bg-[#ECE8E1]/60 transition-colors"
                >
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#030925] w-10 sm:w-11 text-left shrink-0">
                    {y.year}
                  </span>
                  <div className="flex-1 min-w-[48px] h-2 bg-[#DDD8D0] rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#144980] rounded-sm"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] sm:text-xs font-mono tabular-nums text-[#030925]/75 w-24 sm:w-28 text-right shrink-0">
                    {formatNum(y.count)} {t.statsView.emissionsAbbr} · {formatNum(y.track_plays)}{' '}
                    {t.statsView.tracksAbbr}
                  </span>
                </button>
              );
            })}

            <InfiniteSentinel
              hasMore={yearsHasMore}
              loading={yearsLoading}
              onLoadMore={() => loadYears(yearsList.length, false)}
              scrollRoot={yearsScrollRef}
              loadedCount={yearsList.length}
              totalCount={yearsTotal}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
