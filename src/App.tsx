import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Download,
  Loader2,
  Menu,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { EmissionDrawer } from './components/EmissionDrawer';
import { EmissionsView } from './components/EmissionsView';
import { GlobeView } from './components/GlobeView';
import { HomeView } from './components/HomeView';
import { InfiniteSentinel } from './components/InfiniteSentinel';
import { LegalView } from './components/LegalView';
import { StatsView } from './components/StatsView';
import { formatDuration, formatNumberFR } from './types';
import type { ArchiveStats, SyncStatus, TrackSearchItem } from './types';

type ActiveTab = 'home' | 'tracks' | 'multi' | 'emissions' | 'stats' | 'globe' | 'legal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // Search & Filter State
  const [q, setQ] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [emissionFilter, setEmissionFilter] = useState('');
  const [hasDuration, setHasDuration] = useState<'all' | 'known' | 'missing'>('all');
  const [multiOnly, setMultiOnly] = useState(false);
  const [sort, setSort] = useState('latest');

  // Infinite Scroll Results State
  const [tracks, setTracks] = useState<TrackSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trackRequestSeq = useRef(0);

  // Interactive Row States
  const [selectedEmissionSlug, setSelectedEmissionSlug] = useState<string | null>(null);
  const [expandedTrackIds, setExpandedTrackIds] = useState<Record<number, boolean>>({});
  const [enrichingTrackId, setEnrichingTrackId] = useState<number | null>(null);
  const [editingDurationId, setEditingDurationId] = useState<number | null>(null);
  const [durationDraft, setDurationDraft] = useState('');
  const [durationError, setDurationError] = useState<string | null>(null);

  // Audio Preview
  const [playingPreviewTrackId, setPlayingPreviewTrackId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) return;
      const data = (await res.json()) as ArchiveStats;
      setStats(data);
      setSyncStatus(data.syncStatus);
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Poll sync status while a background task is running
  useEffect(() => {
    if (!syncStatus?.running) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/sync/status');
        if (!res.ok) return;
        const nextStatus = (await res.json()) as SyncStatus;
        setSyncStatus(nextStatus);
        if (!nextStatus.running) {
          fetchStats();
        }
      } catch {
        // Ignore
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [syncStatus?.running, fetchStats]);

  const fetchTracksPage = useCallback(
    async (targetPage: number, reset: boolean) => {
      const seq = ++trackRequestSeq.current;
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (authorFilter.trim()) params.set('author', authorFilter.trim());
        if (countryFilter.trim()) params.set('country', countryFilter.trim());
        if (yearFilter) params.set('year', yearFilter);
        if (emissionFilter) params.set('emission', emissionFilter);
        if (activeTab === 'multi' || multiOnly) params.set('multiOnly', 'true');
        if (hasDuration !== 'all') params.set('hasDuration', hasDuration);
        params.set('sort', sort);
        params.set('page', String(targetPage));
        params.set('limit', '40');

        const res = await fetch(`/api/tracks?${params.toString()}`);
        if (!res.ok) throw new Error('Erreur lors de la recherche dans la base.');
        const data = await res.json();
        if (seq !== trackRequestSeq.current) return;

        const nextItems: TrackSearchItem[] = data.items ?? [];
        setTracks((prev) => (reset ? nextItems : [...prev, ...nextItems]));
        setTotal(data.total ?? 0);
        setPage(targetPage);
        setHasMore(targetPage < (data.totalPages ?? 1));
      } catch (err) {
        if (seq === trackRequestSeq.current) {
          setError((err as Error).message);
        }
      } finally {
        if (seq === trackRequestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      q,
      authorFilter,
      countryFilter,
      yearFilter,
      emissionFilter,
      activeTab,
      multiOnly,
      hasDuration,
      sort,
    ]
  );

  useEffect(() => {
    if (activeTab !== 'tracks' && activeTab !== 'multi') return;
    const timer = setTimeout(() => {
      fetchTracksPage(1, true);
    }, 180);
    return () => clearTimeout(timer);
  }, [activeTab, fetchTracksPage]);

  // Refresh track list once background crawl/enrich completes
  useEffect(() => {
    if (syncStatus && !syncStatus.running && syncStatus.finishedAt) {
      if (activeTab === 'tracks' || activeTab === 'multi') {
        fetchTracksPage(1, true);
      }
    }
  }, [syncStatus?.running, syncStatus?.finishedAt]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleTriggerSync = async () => {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full: false }),
      });
      const data = await res.json();
      if (data.syncStatus) setSyncStatus(data.syncStatus);
    } catch {
      // Ignore
    }
  };

  const handleEnrichBatch = async () => {
    try {
      const res = await fetch('/api/enrich-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 250 }),
      });
      const data = await res.json();
      if (data.syncStatus) setSyncStatus(data.syncStatus);
    } catch {
      // Ignore
    }
  };

  const handleEnrichSingleTrack = async (trackId: number) => {
    setEnrichingTrackId(trackId);
    try {
      const res = await fetch(`/api/tracks/${trackId}/enrich`, { method: 'POST' });
      const data = (await res.json()) as {
        found: boolean;
        duration_sec: number | null;
        duration_source: string | null;
        preview_url: string | null;
      };
      if (data.found) {
        setTracks((prev) =>
          prev.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  duration_sec: data.duration_sec,
                  duration_source: data.duration_source,
                  preview_url: data.preview_url,
                }
              : t
          )
        );
        fetchStats();
      } else {
        setEditingDurationId(trackId);
        setDurationDraft('');
        setDurationError('Introuvable — saisie mm:ss');
      }
    } finally {
      setEnrichingTrackId(null);
    }
  };

  const handleSaveManualDuration = async (trackId: number) => {
    setDurationError(null);
    try {
      const res = await fetch(`/api/tracks/${trackId}/duration`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_sec: durationDraft.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDurationError(data.error || 'Format invalide');
        return;
      }
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? { ...t, duration_sec: data.duration_sec, duration_source: 'manual' }
            : t
        )
      );
      setEditingDurationId(null);
      setDurationDraft('');
      fetchStats();
    } catch {
      setDurationError('Erreur réseau');
    }
  };

  const togglePreview = (trackId: number) => {
    if (playingPreviewTrackId === trackId && audioRef.current) {
      audioRef.current.pause();
      setPlayingPreviewTrackId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`/api/tracks/${trackId}/preview`);
    audio.onended = () => setPlayingPreviewTrackId(null);
    audio.onerror = () => setPlayingPreviewTrackId(null);
    audio.play().catch(() => setPlayingPreviewTrackId(null));
    audioRef.current = audio;
    setPlayingPreviewTrackId(trackId);
  };

  const resetFilters = () => {
    setQ('');
    setAuthorFilter('');
    setCountryFilter('');
    setYearFilter('');
    setEmissionFilter('');
    setHasDuration('all');
    setMultiOnly(false);
    setSort('latest');
  };

  const hasActiveFilters = Boolean(
    q.trim() ||
      authorFilter.trim() ||
      countryFilter.trim() ||
      yearFilter ||
      emissionFilter ||
      hasDuration !== 'all' ||
      multiOnly
  );

  const exportCsvUrl = (() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (authorFilter.trim()) params.set('author', authorFilter.trim());
    if (countryFilter.trim()) params.set('country', countryFilter.trim());
    if (yearFilter) params.set('year', yearFilter);
    if (emissionFilter) params.set('emission', emissionFilter);
    if (activeTab === 'multi' || multiOnly) params.set('multiOnly', 'true');
    params.set('sort', sort);
    return `/api/export.csv?${params.toString()}`;
  })();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    if (tab === 'multi') {
      setSort('appearances_desc');
    } else if (tab === 'tracks' && sort === 'appearances_desc') {
      setSort('latest');
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#ECE8E1] text-[#030925]">
      {/* Compact single-row Top Bar (56px mobile = 8.4% of 667px viewport, 64px desktop) */}
      <header className="bg-[#030925] text-[#FAF8F5] sticky top-0 z-30 border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-3 lg:gap-6">
          {/* Zone 1: Single-element Brand wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              switchTab('home');
              resetFilters();
            }}
            className="font-display text-[15px] sm:text-lg font-bold tracking-wide text-[#FAF8F5] whitespace-nowrap truncate hover:text-[#9ECAC2] transition-colors min-w-0 shrink-0"
          >
            La Planète Bleue FanStats
          </a>

          {/* Zone 2: Clean single-line text navigation links (desktop lg+) */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs xl:text-[13px] font-medium tracking-wider uppercase font-display">
            <button
              type="button"
              onClick={() => switchTab('home')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'home'
                  ? 'text-[#9ECAC2] border-[#9ECAC2]'
                  : 'text-[#ECE8E1]/85 border-transparent hover:text-[#9ECAC2]'
              }`}
            >
              Accueil
            </button>
            <button
              type="button"
              onClick={() => switchTab('globe')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'globe'
                  ? 'text-[#9ECAC2] border-[#9ECAC2]'
                  : 'text-[#ECE8E1]/85 border-transparent hover:text-[#9ECAC2]'
              }`}
            >
              Vue 3D
            </button>
            <button
              type="button"
              onClick={() => switchTab('tracks')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'tracks'
                  ? 'text-[#9ECAC2] border-[#9ECAC2]'
                  : 'text-[#ECE8E1]/85 border-transparent hover:text-[#9ECAC2]'
              }`}
            >
              Titres
            </button>
            <button
              type="button"
              onClick={() => switchTab('multi')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'multi'
                  ? 'text-[#9ECAC2] border-[#9ECAC2]'
                  : 'text-[#ECE8E1]/85 border-transparent hover:text-[#9ECAC2]'
              }`}
            >
              Multi-diffusions
            </button>
            <button
              type="button"
              onClick={() => switchTab('emissions')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'emissions'
                  ? 'text-[#9ECAC2] border-[#9ECAC2]'
                  : 'text-[#ECE8E1]/85 border-transparent hover:text-[#9ECAC2]'
              }`}
            >
              Émissions
            </button>
            <button
              type="button"
              onClick={() => switchTab('stats')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'stats'
                  ? 'text-[#9ECAC2] border-[#9ECAC2]'
                  : 'text-[#ECE8E1]/85 border-transparent hover:text-[#9ECAC2]'
              }`}
            >
              Statistiques
            </button>
            <button
              type="button"
              onClick={() => switchTab('legal')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'legal'
                  ? 'text-[#9ECAC2] border-[#9ECAC2]'
                  : 'text-[#ECE8E1]/85 border-transparent hover:text-[#9ECAC2]'
              }`}
            >
              Mentions légales
            </button>
          </nav>

          {/* Zone 3: Primary action + Mobile Menu Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTriggerSync}
              disabled={syncStatus?.running}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 min-h-[40px] text-xs font-semibold text-[#030925] bg-[#9ECAC2] hover:bg-[#FAF8F5] rounded-md transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#9ECAC2]"
              aria-label="Synchroniser la base"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus?.running ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {syncStatus?.running ? 'Synchronisation…' : 'Synchroniser'}
              </span>
              <span className="sm:hidden">{syncStatus?.running ? 'Sync…' : 'Sync'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-[#FAF8F5] hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-[#9ECAC2]"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Slide-down Mobile/Tablet Navigation Sheet */}
        {mobileMenuOpen && (
          <nav
            aria-label="Navigation principale"
            className="lg:hidden border-t border-white/10 bg-[#030925] px-4 py-3 grid grid-cols-2 gap-2"
          >
            {(
              [
                ['home', 'Accueil'],
                ['globe', 'Vue 3D'],
                ['tracks', 'Titres'],
                ['multi', 'Multi-diffusions'],
                ['emissions', 'Émissions'],
                ['stats', 'Statistiques'],
                ['legal', 'Mentions légales'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchTab(key)}
                className={`${key === 'home' ? 'col-span-2 ' : ''}min-h-[44px] px-3 py-2 rounded-md text-left text-xs font-display font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === key
                    ? 'bg-[#144980] text-[#9ECAC2] border border-[#9ECAC2]/50'
                    : 'bg-white/5 text-[#ECE8E1] border border-white/10 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {activeTab === 'globe' ? (
        <GlobeView
          years={stats?.years ?? []}
          onSelectEmission={setSelectedEmissionSlug}
          onInspectCountryInTable={(countryName, query) => {
            setCountryFilter(countryName);
            if (query.trim()) setQ(query);
            setActiveTab('tracks');
          }}
        />
      ) : activeTab === 'home' ? (
        <>
          <HomeView
            stats={stats}
            onNavigate={(targetTab) => switchTab(targetTab)}
            onQuickSearch={(query) => {
              setQ(query);
              switchTab('tracks');
            }}
            onFilterByAuthor={(author) => {
              setAuthorFilter(author);
              switchTab('tracks');
            }}
            onFilterByCountry={(country) => {
              setCountryFilter(country);
              switchTab('tracks');
            }}
          />
          <footer className="bg-[#144980] text-[#ECE8E1] mt-auto">
            <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-center sm:text-left">
              <span>
                La Planète Bleue FanStats · Par{' '}
                <a
                  href="https://www.linkedin.com/in/fredneau/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#9ECAC2] hover:underline font-semibold"
                >
                  Fred Neau / un ecologeek
                </a>
              </span>
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => switchTab('legal')}
                  className="text-[#ECE8E1]/90 hover:text-[#9ECAC2] hover:underline font-semibold py-1"
                >
                  Mentions légales
                </button>
                <span className="text-white/25" aria-hidden="true">
                  ·
                </span>
                <a
                  href="https://laplanetebleue.com/fr/emissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#9ECAC2] hover:underline font-semibold py-1"
                >
                  Source officielle : laplanetebleue.com
                </a>
              </div>
            </div>
          </footer>
        </>
      ) : (
        <>
          {/* Signature La Planète Bleue Blue Horizon Band */}
          <section className="bg-gradient-to-b from-[#030925] to-[#144980] text-[#FAF8F5] relative overflow-hidden">
            <div className="max-w-[1360px] mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-8 sm:pb-12 relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
              <div className="space-y-1.5 sm:space-y-2 max-w-2xl">
                <h1 className="font-display text-xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                  {activeTab === 'legal'
                    ? 'Mentions légales & À propos'
                    : activeTab === 'emissions'
                      ? 'Archive des émissions'
                      : activeTab === 'stats'
                        ? 'Statistiques & classements de la discothèque'
                        : activeTab === 'multi'
                          ? 'Titres diffusés dans plusieurs émissions'
                          : 'Base de données des titres diffusés'}
                </h1>
                <p className="text-xs sm:text-base text-[#ECE8E1]/90 italic leading-relaxed">
                  Qu’est-ce qu’on écoutera dans 10 ans ? Et dans 100 ans ? — Index complet des titres,
                  auteurs, durées, émissions et dates de diffusion (1995–2026).
                </p>
              </div>

              {(activeTab === 'tracks' || activeTab === 'multi') && (
                <div className="grid grid-cols-2 sm:flex items-center gap-2.5 w-full lg:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleEnrichBatch}
                    disabled={syncStatus?.running}
                    className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 min-h-[44px] sm:min-h-[38px] text-xs font-semibold text-[#FAF8F5] bg-[#030925]/45 border border-[#9ECAC2]/40 hover:bg-[#030925]/70 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#9ECAC2] shrink-0" />
                    <span>Enrichir durées</span>
                  </button>
                  <a
                    href={exportCsvUrl}
                    className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 min-h-[44px] sm:min-h-[38px] text-xs font-semibold text-[#FAF8F5] bg-[#030925]/45 border border-[#9ECAC2]/40 hover:bg-[#030925]/70 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-[#9ECAC2] shrink-0" />
                    <span>Exporter CSV</span>
                  </a>
                </div>
              )}
            </div>

            {/* Curved Planetary Horizon Transition onto Beige Canvas */}
            <div className="h-4 sm:h-6 w-full overflow-hidden leading-none" aria-hidden="true">
              <svg
                viewBox="0 0 1440 48"
                preserveAspectRatio="none"
                className="w-full h-full block"
              >
                <path
                  d="M0,0 C360,46 1080,46 1440,0 L1440,48 L0,48 Z"
                  fill="#ECE8E1"
                />
              </svg>
            </div>
          </section>

          <main className="flex-1 max-w-[1360px] w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Live Background Task Progress Banner */}
            {syncStatus?.running && (
              <div className="bg-[#FAF8F5] border border-[#144980]/30 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Loader2 className="w-4 h-4 text-[#144980] animate-spin shrink-0" />
                  <span className="text-sm text-[#030925] truncate">{syncStatus.message}</span>
                </div>
                {syncStatus.total > 0 && (
                  <span className="text-xs font-mono tabular-nums text-[#144980] font-semibold shrink-0">
                    {Math.round((syncStatus.processed / syncStatus.total) * 100)}%
                  </span>
                )}
              </div>
            )}

            {/* 4-column Summary KPI Strip */}
            {stats && activeTab !== 'legal' && (
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <button
                  type="button"
                  onClick={() => {
                    switchTab('tracks');
                    setMultiOnly(false);
                  }}
                  className="text-left bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg px-3.5 py-3 sm:px-4 sm:py-3.5 hover:border-[#144980] transition-colors min-h-[68px]"
                >
                  <div className="text-[11px] sm:text-xs text-[#030925]/65">Titres uniques indexés</div>
                  <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#030925] mt-0.5 sm:mt-1">
                    {formatNumberFR(stats.tracks_count)}
                  </div>
                </button>

                <div className="bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg px-3.5 py-3 sm:px-4 sm:py-3.5 min-h-[68px]">
                  <div className="text-[11px] sm:text-xs text-[#030925]/65">Passages en émission</div>
                  <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#030925] mt-0.5 sm:mt-1">
                    {formatNumberFR(stats.appearances_count)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => switchTab('emissions')}
                  className="text-left bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg px-3.5 py-3 sm:px-4 sm:py-3.5 hover:border-[#144980] transition-colors min-h-[68px]"
                >
                  <div className="text-[11px] sm:text-xs text-[#030925]/65">Émissions archivées</div>
                  <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#030925] mt-0.5 sm:mt-1">
                    {formatNumberFR(stats.emissions_count)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => switchTab('multi')}
                  className="text-left bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg px-3.5 py-3 sm:px-4 sm:py-3.5 hover:border-[#144980] transition-colors min-h-[68px]"
                >
                  <div className="text-[11px] sm:text-xs text-[#030925]/65">Titres multi-diffusions</div>
                  <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#144980] mt-0.5 sm:mt-1">
                    {formatNumberFR(stats.multi_emission_tracks)}
                  </div>
                </button>
              </section>
            )}

            {/* Main View Content */}
            {activeTab === 'legal' && (
              <LegalView onNavigate={(targetTab) => switchTab(targetTab)} />
            )}

            {activeTab === 'emissions' && stats && (
              <EmissionsView years={stats.years} onSelectEmission={setSelectedEmissionSlug} />
            )}

            {activeTab === 'stats' && stats && (
              <StatsView
                stats={stats}
                onEnrichBatch={handleEnrichBatch}
                onFilterByAuthor={(author) => {
                  setAuthorFilter(author);
                  setActiveTab('tracks');
                }}
                onFilterByCountry={(country) => {
                  setCountryFilter(country);
                  setActiveTab('tracks');
                }}
                onFilterByYear={(yr) => {
                  setYearFilter(String(yr));
                  setActiveTab('tracks');
                }}
                onFilterByTrack={(query) => {
                  setQ(query);
                  setActiveTab('tracks');
                }}
              />
            )}

            {(activeTab === 'tracks' || activeTab === 'multi') && (
              <section className="space-y-4">
                {/* Search & Filters Bar */}
                <div className="bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#030925]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Rechercher titre, auteur, label, pays ou nº…"
                        className="w-full pl-10 pr-10 min-h-[44px] py-2 text-base sm:text-sm bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980] transition-colors"
                      />
                      {q && (
                        <button
                          type="button"
                          onClick={() => setQ('')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[#030925]/45 hover:text-[#030925]"
                          aria-label="Effacer la recherche"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
                      <input
                        type="text"
                        value={authorFilter}
                        onChange={(e) => setAuthorFilter(e.target.value)}
                        placeholder="Filtrer par auteur…"
                        aria-label="Filtrer par auteur"
                        className="col-span-2 sm:w-44 min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980]"
                      />

                      <input
                        type="number"
                        min={1}
                        max={2000}
                        value={emissionFilter}
                        onChange={(e) => setEmissionFilter(e.target.value)}
                        placeholder="Nº émission"
                        aria-label="Filtrer par numéro d'émission"
                        className="w-full sm:w-28 min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980]"
                      />

                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        aria-label="Filtrer par année"
                        className="w-full sm:w-auto min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980]"
                      >
                        <option value="">Toutes années</option>
                        {stats?.years.map((y) => (
                          <option key={y.year} value={String(y.year)}>
                            {y.year}
                          </option>
                        ))}
                      </select>

                      <select
                        value={countryFilter}
                        onChange={(e) => setCountryFilter(e.target.value)}
                        aria-label="Filtrer par pays"
                        className="col-span-2 sm:col-span-1 w-full sm:w-auto sm:max-w-[170px] min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980]"
                      >
                        <option value="">Tous pays</option>
                        {countryFilter &&
                          !stats?.topCountries.some((c) => c.country === countryFilter) && (
                            <option value={countryFilter}>{countryFilter}</option>
                          )}
                        {stats?.topCountries.map((c) => (
                          <option key={c.country} value={c.country}>
                            {c.country}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-[#DDD8D0]/70">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      {/* Segmented duration filter */}
                      <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-[#ECE8E1] rounded-md w-full sm:w-auto">
                        {(
                          [
                            ['all', 'Toutes'],
                            ['known', 'Durée OK'],
                            ['missing', 'Sans durée'],
                          ] as const
                        ).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setHasDuration(val)}
                            className={`px-2 sm:px-2.5 min-h-[38px] sm:min-h-[28px] py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 text-center ${
                              hasDuration === val
                                ? 'bg-[#030925] text-[#FAF8F5]'
                                : 'text-[#030925]/70 hover:text-[#030925]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {activeTab === 'tracks' && (
                        <button
                          type="button"
                          onClick={() => setMultiOnly((v) => !v)}
                          className={`w-full sm:w-auto min-h-[40px] sm:min-h-[32px] px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                            multiOnly
                              ? 'bg-[#144980] text-[#FAF8F5] border-[#144980]'
                              : 'bg-white text-[#030925]/80 border-[#DDD8D0] hover:border-[#144980]'
                          }`}
                        >
                          Diffusés plusieurs fois uniquement
                        </button>
                      )}

                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#144980] hover:text-[#030925] px-2 min-h-[36px] whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Réinitialiser</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                      <span className="text-xs font-mono tabular-nums text-[#030925]/65 whitespace-nowrap">
                        {formatNumberFR(tracks.length)} / {formatNumberFR(total)} résultat
                        {total > 1 ? 's' : ''}
                      </span>
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        aria-label="Trier les résultats"
                        className="min-h-[42px] sm:min-h-[34px] px-2.5 py-1.5 text-base sm:text-xs font-semibold bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980]"
                      >
                        <option value="latest">Diffusion : plus récents</option>
                        <option value="oldest">Diffusion : plus anciens</option>
                        <option value="appearances_desc">Plus diffusés</option>
                        <option value="title">Titre (A–Z)</option>
                        <option value="author">Auteur (A–Z)</option>
                        <option value="duration_desc">Durée décroissante</option>
                        <option value="duration_asc">Durée croissante</option>
                      </select>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-900">
                    {error}
                  </div>
                )}

                {/* Tracks Results: Mobile Touch Card List (<md) + Desktop Table (md:) */}
                <div className="bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg overflow-hidden">
                  {/* Mobile Card List */}
                  <div className="md:hidden divide-y divide-[#DDD8D0]">
                    {loading && tracks.length === 0 ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="p-4 space-y-2.5 animate-pulse">
                          <div className="h-4 bg-[#DDD8D0]/60 rounded w-3/4" />
                          <div className="h-3.5 bg-[#DDD8D0]/60 rounded w-1/2" />
                          <div className="h-3 bg-[#DDD8D0]/60 rounded w-2/3" />
                        </div>
                      ))
                    ) : tracks.length === 0 ? (
                      <div className="py-12 px-5 text-center">
                        <p className="text-sm font-semibold text-[#030925]">
                          Aucun titre ne correspond à vos critères
                        </p>
                        <p className="text-xs text-[#030925]/65 mt-1">
                          Essayez un autre mot-clé, supprimez un filtre ou lancez une
                          synchronisation.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-4 px-4 min-h-[44px] text-xs font-semibold text-[#144980] border border-[#DDD8D0] bg-white rounded-md hover:border-[#144980]"
                          >
                            Réinitialiser les filtres
                          </button>
                        )}
                      </div>
                    ) : (
                      tracks.map((track) => {
                        const isExpanded = Boolean(expandedTrackIds[track.id]);
                        const visibleAppearances = isExpanded
                          ? track.appearances
                          : track.appearances.slice(0, 2);
                        const hiddenCount = track.appearances.length - visibleAppearances.length;

                        return (
                          <article key={track.id} className="p-3.5 space-y-2">
                            {/* Top Row: Play + Title/Label + Duration */}
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-start gap-2.5 min-w-0">
                                {track.preview_url && (
                                  <button
                                    type="button"
                                    onClick={() => togglePreview(track.id)}
                                    className={`w-11 h-11 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                      playingPreviewTrackId === track.id
                                        ? 'bg-[#030925] text-[#9ECAC2] border-[#030925]'
                                        : 'bg-white text-[#144980] border-[#DDD8D0] active:bg-[#9ECAC2]/30'
                                    }`}
                                    title="Écouter un extrait audio de 30 secondes"
                                    aria-label={`Extrait de ${track.title}`}
                                  >
                                    {playingPreviewTrackId === track.id ? (
                                      <Pause className="w-4 h-4" />
                                    ) : (
                                      <Play className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                                <div className="min-w-0">
                                  <h3 className="font-bold text-[15px] text-[#030925] leading-snug break-words">
                                    {track.title}
                                  </h3>
                                  {track.label && (
                                    <div className="text-xs text-[#030925]/60 mt-0.5 break-words">
                                      ({track.label})
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 flex flex-col items-end">
                                {editingDurationId === track.id ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={durationDraft}
                                        onChange={(e) => setDurationDraft(e.target.value)}
                                        placeholder="04:32"
                                        className="w-20 min-h-[38px] px-2 py-1 text-base sm:text-xs font-mono text-right bg-white border border-[#144980] rounded focus:outline-none"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveManualDuration(track.id);
                                          if (e.key === 'Escape') setEditingDurationId(null);
                                        }}
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveManualDuration(track.id)}
                                        className="w-9 h-9 flex items-center justify-center text-emerald-800 bg-emerald-50 rounded"
                                        aria-label="Enregistrer la durée"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDurationId(null);
                                          setDurationError(null);
                                        }}
                                        className="w-9 h-9 flex items-center justify-center text-[#030925]/60 bg-white border border-[#DDD8D0] rounded"
                                        aria-label="Annuler"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                    {durationError && (
                                      <span className="text-[11px] text-amber-800 text-right">
                                        {durationError}
                                      </span>
                                    )}
                                  </div>
                                ) : track.duration_sec ? (
                                  <div className="inline-flex items-center gap-1">
                                    <span className="text-xs font-mono tabular-nums font-semibold text-[#030925]">
                                      {formatDuration(track.duration_sec)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingDurationId(track.id);
                                        setDurationDraft(formatDuration(track.duration_sec));
                                        setDurationError(null);
                                      }}
                                      className="w-8 h-8 flex items-center justify-center text-[#030925]/50 hover:text-[#030925]"
                                      aria-label={`Modifier la durée de ${track.title}`}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={enrichingTrackId === track.id}
                                      onClick={() => handleEnrichSingleTrack(track.id)}
                                      className="inline-flex items-center gap-1 min-h-[36px] text-xs text-[#144980] font-medium px-2.5 py-1 rounded bg-white border border-[#DDD8D0]"
                                    >
                                      {enrichingTrackId === track.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Search className="w-3.5 h-3.5" />
                                      )}
                                      <span>Durée</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingDurationId(track.id);
                                        setDurationDraft('');
                                        setDurationError(null);
                                      }}
                                      className="w-9 h-9 flex items-center justify-center text-[#030925]/50"
                                      aria-label={`Saisir manuellement la durée de ${track.title}`}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Author & Country Metadata */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                              <button
                                type="button"
                                onClick={() => setAuthorFilter(track.author)}
                                className="font-semibold text-[#144980] hover:underline text-left py-0.5"
                              >
                                {track.author}
                              </button>
                              {track.country && (
                                <>
                                  <span aria-hidden="true" className="text-[#030925]/30">
                                    ·
                                  </span>
                                  <span className="text-xs uppercase tracking-wide text-[#030925]/70">
                                    {track.country}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Emissions & Broadcast Dates */}
                            <div className="space-y-1 pt-0.5">
                              {visibleAppearances.map((app, idx) => (
                                <div
                                  key={`${app.emission_id}-${app.position}-${app.version}-${idx}`}
                                  className="text-xs flex flex-wrap items-center gap-x-1.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setSelectedEmissionSlug(app.emission_slug)}
                                    className="font-mono tabular-nums font-semibold text-[#144980] hover:underline py-1 whitespace-nowrap"
                                  >
                                    nº {app.emission_number ?? app.emission_slug}
                                  </button>
                                  <span aria-hidden="true" className="text-[#030925]/30">
                                    ·
                                  </span>
                                  <span className="font-mono tabular-nums text-[#030925]/75">
                                    {app.broadcast_date_label ||
                                      app.broadcast_date ||
                                      'Date inconnue'}
                                  </span>
                                  {app.version !== 'standard' && (
                                    <>
                                      <span aria-hidden="true" className="text-[#030925]/30">
                                        ·
                                      </span>
                                      <span className="text-[#144980]">
                                        {app.version === 'unlimited' ? 'Unlimited' : 'Radio'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ))}

                              {hiddenCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedTrackIds((prev) => ({
                                      ...prev,
                                      [track.id]: true,
                                    }))
                                  }
                                  className="text-xs text-[#144980] font-semibold py-1.5"
                                >
                                  + {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} diffusion
                                  {hiddenCount > 1 ? 's' : ''}
                                </button>
                              )}

                              {isExpanded && track.appearances.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedTrackIds((prev) => ({
                                      ...prev,
                                      [track.id]: false,
                                    }))
                                  }
                                  className="text-xs text-[#030925]/60 py-1.5"
                                >
                                  Réduire
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>

                  {/* Desktop High-Density Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#DDD8D0] bg-[#030925] text-xs font-display font-semibold uppercase tracking-wider text-[#ECE8E1]">
                          <th className="py-3 px-4 w-[28%]">Titre &amp; Label</th>
                          <th className="py-3 px-4 w-[20%]">Auteur</th>
                          <th className="py-3 px-4 w-[12%] text-right">Durée</th>
                          <th className="py-3 px-4 w-[12%]">Origine</th>
                          <th className="py-3 px-4 w-[28%]">Émissions &amp; dates de diffusion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DDD8D0]/70 text-sm">
                        {loading && tracks.length === 0 ? (
                          Array.from({ length: 10 }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td className="py-3.5 px-4">
                                <div className="h-4 bg-[#DDD8D0]/60 rounded w-3/4" />
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="h-4 bg-[#DDD8D0]/60 rounded w-2/3" />
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="h-4 bg-[#DDD8D0]/60 rounded w-12 ml-auto" />
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="h-4 bg-[#DDD8D0]/60 rounded w-16" />
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="h-4 bg-[#DDD8D0]/60 rounded w-5/6" />
                              </td>
                            </tr>
                          ))
                        ) : tracks.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-16 px-6 text-center">
                              <p className="text-sm font-semibold text-[#030925]">
                                Aucun titre ne correspond à vos critères
                              </p>
                              <p className="text-xs text-[#030925]/65 mt-1">
                                Essayez un autre mot-clé, supprimez un filtre ou lancez une
                                synchronisation.
                              </p>
                              {hasActiveFilters && (
                                <button
                                  type="button"
                                  onClick={resetFilters}
                                  className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-[#144980] border border-[#DDD8D0] bg-white rounded-md hover:border-[#144980]"
                                >
                                  Réinitialiser les filtres
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          tracks.map((track) => {
                            const isExpanded = Boolean(expandedTrackIds[track.id]);
                            const visibleAppearances = isExpanded
                              ? track.appearances
                              : track.appearances.slice(0, 2);
                            const hiddenCount = track.appearances.length - visibleAppearances.length;

                            return (
                              <tr
                                key={track.id}
                                className="hover:bg-[#ECE8E1]/50 transition-colors align-top"
                              >
                                {/* Titre & Label */}
                                <td className="py-3 px-4">
                                  <div className="flex items-start gap-2">
                                    {track.preview_url && (
                                      <button
                                        type="button"
                                        onClick={() => togglePreview(track.id)}
                                        className="mt-0.5 p-1.5 rounded text-[#144980] hover:bg-[#9ECAC2]/30 transition-colors shrink-0"
                                        title="Écouter un extrait audio de 30 secondes"
                                        aria-label={`Extrait de ${track.title}`}
                                      >
                                        {playingPreviewTrackId === track.id ? (
                                          <Pause className="w-3.5 h-3.5" />
                                        ) : (
                                          <Play className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-bold text-[#030925] leading-snug">
                                        {track.title}
                                      </div>
                                      {track.label && (
                                        <div className="text-xs text-[#030925]/60 mt-0.5">
                                          ({track.label})
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Auteur */}
                                <td className="py-3 px-4">
                                  <button
                                    type="button"
                                    onClick={() => setAuthorFilter(track.author)}
                                    className="text-left font-semibold text-[#144980] hover:text-[#030925] hover:underline leading-snug"
                                    title={`Filtrer par ${track.author}`}
                                  >
                                    {track.author}
                                  </button>
                                </td>

                                {/* Durée */}
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  {editingDurationId === track.id ? (
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          value={durationDraft}
                                          onChange={(e) => setDurationDraft(e.target.value)}
                                          placeholder="04:32"
                                          className="w-16 px-1.5 py-1 text-xs font-mono text-right bg-white border border-[#144980] rounded focus:outline-none"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveManualDuration(track.id);
                                            if (e.key === 'Escape') setEditingDurationId(null);
                                          }}
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveManualDuration(track.id)}
                                          className="p-1 text-emerald-800 hover:bg-emerald-100 rounded"
                                          aria-label="Enregistrer la durée"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingDurationId(null);
                                            setDurationError(null);
                                          }}
                                          className="p-1 text-[#030925]/50 hover:text-[#030925] rounded"
                                          aria-label="Annuler"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      {durationError && (
                                        <span className="text-[11px] text-amber-800 max-w-[160px] whitespace-normal text-right">
                                          {durationError}
                                        </span>
                                      )}
                                    </div>
                                  ) : track.duration_sec ? (
                                    <div className="inline-flex items-center gap-1.5 group">
                                      <span
                                        className="font-mono tabular-nums text-[#030925]"
                                        title={
                                          track.duration_source
                                            ? `Source : ${track.duration_source}`
                                            : undefined
                                        }
                                      >
                                        {formatDuration(track.duration_sec)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDurationId(track.id);
                                          setDurationDraft(formatDuration(track.duration_sec));
                                          setDurationError(null);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 p-1 text-[#030925]/45 hover:text-[#030925] transition-opacity"
                                        title="Modifier la durée"
                                        aria-label={`Modifier la durée de ${track.title}`}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={enrichingTrackId === track.id}
                                        onClick={() => handleEnrichSingleTrack(track.id)}
                                        className="inline-flex items-center gap-1 text-xs text-[#030925]/70 hover:text-[#144980] px-1.5 py-0.5 rounded bg-white border border-[#DDD8D0] hover:border-[#144980] transition-colors"
                                        title="Rechercher la durée sur Deezer / iTunes"
                                      >
                                        {enrichingTrackId === track.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Search className="w-3 h-3" />
                                        )}
                                        <span>Chercher</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDurationId(track.id);
                                          setDurationDraft('');
                                          setDurationError(null);
                                        }}
                                        className="p-1 text-[#030925]/45 hover:text-[#030925]"
                                        title="Saisir la durée manuellement"
                                        aria-label={`Saisir manuellement la durée de ${track.title}`}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </td>

                                {/* Pays */}
                                <td className="py-3 px-4 text-xs uppercase tracking-wide text-[#030925]/75">
                                  {track.country || '—'}
                                </td>

                                {/* Émissions & dates de diffusion */}
                                <td className="py-3 px-4">
                                  <div className="space-y-1">
                                    {visibleAppearances.map((app, idx) => (
                                      <div
                                        key={`${app.emission_id}-${app.position}-${app.version}-${idx}`}
                                        className="text-xs flex flex-wrap items-baseline gap-x-1.5"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => setSelectedEmissionSlug(app.emission_slug)}
                                          className="font-mono tabular-nums font-semibold text-[#144980] hover:text-[#030925] hover:underline whitespace-nowrap"
                                        >
                                          nº {app.emission_number ?? app.emission_slug}
                                        </button>
                                        <span aria-hidden="true" className="text-[#030925]/30">
                                          ·
                                        </span>
                                        <span className="font-mono tabular-nums text-[#030925]/75 whitespace-nowrap">
                                          {app.broadcast_date_label ||
                                            app.broadcast_date ||
                                            'Date inconnue'}
                                        </span>
                                        {app.version !== 'standard' && (
                                          <>
                                            <span aria-hidden="true" className="text-[#030925]/30">
                                              ·
                                            </span>
                                            <span className="text-[#144980]">
                                              {app.version === 'unlimited' ? 'Unlimited' : 'Radio'}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    ))}

                                    {hiddenCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedTrackIds((prev) => ({
                                            ...prev,
                                            [track.id]: true,
                                          }))
                                        }
                                        className="text-xs text-[#144980] hover:underline font-semibold"
                                      >
                                        + {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} diffusion
                                        {hiddenCount > 1 ? 's' : ''}
                                      </button>
                                    )}

                                    {isExpanded && track.appearances.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedTrackIds((prev) => ({
                                            ...prev,
                                            [track.id]: false,
                                          }))
                                        }
                                        className="text-xs text-[#030925]/60 hover:text-[#030925] hover:underline"
                                      >
                                        Réduire
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-[#DDD8D0]/70 bg-[#FAF8F5]">
                    <InfiniteSentinel
                      hasMore={hasMore}
                      loading={loadingMore}
                      onLoadMore={() => fetchTracksPage(page + 1, false)}
                      loadedCount={tracks.length}
                      totalCount={total}
                    />
                  </div>
                </div>
              </section>
            )}
          </main>

          <footer className="bg-[#144980] text-[#ECE8E1] mt-auto">
            <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-center sm:text-left">
              <span>
                La Planète Bleue FanStats · Par{' '}
                <a
                  href="https://www.linkedin.com/in/fredneau/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#9ECAC2] hover:underline font-semibold"
                >
                  Fred Neau / un ecologeek
                </a>
              </span>
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => {
                    switchTab('legal');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-[#ECE8E1]/90 hover:text-[#9ECAC2] hover:underline font-semibold py-1"
                >
                  Mentions légales
                </button>
                <span className="text-white/25" aria-hidden="true">
                  ·
                </span>
                <a
                  href="https://laplanetebleue.com/fr/emissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#9ECAC2] hover:underline font-semibold py-1"
                >
                  Source officielle : laplanetebleue.com
                </a>
              </div>
            </div>
          </footer>
        </>
      )}

      <EmissionDrawer
        slug={selectedEmissionSlug}
        onClose={() => setSelectedEmissionSlug(null)}
        onSelectEmission={(slug) => setSelectedEmissionSlug(slug)}
        onFilterByAuthor={(author) => {
          setAuthorFilter(author);
          setActiveTab('tracks');
        }}
      />
    </div>
  );
}
