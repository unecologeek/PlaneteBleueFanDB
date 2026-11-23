import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  ExternalLink,
  Globe,
  Layers,
  ListMusic,
  Radio,
  Search,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { ArchiveStats } from '../types';

export type NavSection = 'tracks' | 'multi' | 'emissions' | 'stats' | 'globe' | 'legal';

interface HomeViewProps {
  stats: ArchiveStats | null;
  onNavigate: (tab: NavSection) => void;
  onQuickSearch: (query: string) => void;
  onFilterByAuthor: (author: string) => void;
  onFilterByCountry: (country: string) => void;
}

export function HomeView({
  stats,
  onNavigate,
  onQuickSearch,
  onFilterByAuthor,
  onFilterByCountry,
}: HomeViewProps) {
  const { t, formatNum } = useI18n();
  const [quickQuery, setQuickQuery] = useState('');

  const durationPct =
    stats && stats.tracks_count > 0
      ? Math.round((stats.tracks_with_duration / stats.tracks_count) * 100)
      : 0;

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onQuickSearch(quickQuery.trim());
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Bloc 1 : Mise en avant de la Vue 3D avec la capture du Globe Sonore en fond */}
      <section className="relative bg-[#071230] text-[#FAF8F5] overflow-hidden border-b border-white/10">
        {/* Background Screenshot Layer */}
        <img
          src="/assets/aistudio/image_dc5aed3a.png"
          alt={t.home.globeAlt}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-[72%_32%] sm:object-[76%_center] opacity-90 select-none pointer-events-none"
        />

        {/* Measured Contrast Scrims (Vertical on Mobile, Horizontal on Desktop) */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#030925] via-[#030925]/78 to-[#030925]/35 lg:bg-gradient-to-r lg:from-[#030925] lg:via-[#030925]/86 lg:to-[#030925]/15 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#030925] to-transparent pointer-events-none lg:hidden"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20 min-h-[420px] sm:min-h-[480px] lg:min-h-[540px] flex flex-col justify-end lg:justify-center">
          <div className="max-w-xl space-y-4 sm:space-y-5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-display font-semibold uppercase tracking-wider text-[#9ECAC2]">
              <span>{t.home.globeKicker}</span>
              <span aria-hidden="true" className="text-white/30">
                ·
              </span>
              <span>{t.home.globeSubkicker}</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white text-balance leading-[1.1]">
              {t.home.globeTitle}
            </h1>

            <p className="text-sm sm:text-base text-[#ECE8E1]/90 leading-relaxed max-w-lg">
              {t.home.globeDesc}
            </p>

            {stats && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-mono tabular-nums text-[#E8BD6C] pt-0.5">
                <span>
                  {formatNum(stats.emissions_count)} {t.home.emissionsUnit}
                </span>
                <span aria-hidden="true" className="text-white/25">
                  ·
                </span>
                <span>
                  {formatNum(stats.tracks_count)} {t.home.tracksUnit}
                </span>
                <span aria-hidden="true" className="text-white/25">
                  ·
                </span>
                <span>
                  {formatNum(stats.appearances_count)} {t.home.playsUnit}
                </span>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('globe')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 min-h-[48px] text-sm font-bold text-[#030925] bg-[#9ECAC2] hover:bg-[#FAF8F5] rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#FAF8F5]"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span>{t.home.globeCta}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Curved Planetary Horizon Transition onto Beige Canvas */}
        <div className="relative z-10 h-4 sm:h-6 w-full overflow-hidden leading-none" aria-hidden="true">
          <svg
            viewBox="0 0 1440 48"
            preserveAspectRatio="none"
            className="w-full h-full block"
          >
            <path d="M0,0 C360,46 1080,46 1440,0 L1440,48 L0,48 Z" fill="#ECE8E1" />
          </svg>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-3.5 sm:px-6 py-6 sm:py-10 space-y-5 sm:space-y-6">
        {/* Row 1 : Titres (7 cols) + Site officiel (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          {/* Bloc 2 : Titres */}
          <article className="lg:col-span-7 bg-[#FAF8F5] border border-[#DDD8D0] rounded-xl p-5 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-display font-semibold uppercase tracking-wider text-[#144980]">
                  {t.home.tracksKicker}
                </span>
                {stats && (
                  <span className="text-xs font-mono tabular-nums text-[#030925]/65">
                    {formatNum(stats.tracks_count)} {t.home.tracksUnique}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#030925] text-balance">
                  {t.home.tracksTitle}
                </h2>
                <p className="text-sm sm:text-base text-[#030925]/80 leading-relaxed">
                  {t.home.tracksDesc}
                </p>
              </div>

              <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#030925]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={quickQuery}
                    onChange={(e) => setQuickQuery(e.target.value)}
                    placeholder={t.home.tracksPlaceholder}
                    className="w-full pl-10 pr-3 min-h-[44px] py-2 text-base sm:text-sm bg-white border border-[#DDD8D0] rounded-md focus:outline-none focus:border-[#144980] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 min-h-[44px] text-xs font-semibold text-[#FAF8F5] bg-[#030925] hover:bg-[#144980] rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <ListMusic className="w-4 h-4 text-[#9ECAC2]" />
                  <span>{quickQuery.trim() ? t.home.tracksSearchBtn : t.home.tracksOpenBtn}</span>
                </button>
              </form>
            </div>

            {stats && (
              <div className="pt-4 border-t border-[#DDD8D0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#030925]/70">
                <div className="font-mono tabular-nums">
                  {formatNum(stats.appearances_count)} {t.home.tracksIndexedPlays} ·{' '}
                  {formatNum(stats.tracks_with_duration)} {t.home.tracksKnownDurations}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('tracks')}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#144980] hover:underline whitespace-nowrap"
                >
                  <span>{t.home.tracksExploreAll}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </article>

          {/* Bloc 3 : Invitation au site officiel de La Planète Bleue */}
          <article className="lg:col-span-5 bg-[#FAF8F5] border border-[#DDD8D0] rounded-xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="w-full bg-[#030C24] border-b border-[#DDD8D0] px-5 py-7 sm:px-7 sm:py-9 flex items-center justify-center">
                <img
                  src="/assets/aistudio/image_968f0971.png"
                  alt={t.home.officialBannerAlt}
                  referrerPolicy="no-referrer"
                  className="w-full max-w-[360px] h-auto object-contain select-none"
                />
              </div>
              <div className="p-5 sm:p-7 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-display font-semibold uppercase tracking-wider text-[#144980]">
                    {t.home.officialKicker}
                  </span>
                  <span className="text-xs font-mono text-[#030925]/65">laplanetebleue.com</span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#030925] text-balance">
                  {t.home.officialTitle}
                </h2>
                <p className="text-sm text-[#030925]/80 leading-relaxed">
                  {t.home.officialDesc}
                </p>
              </div>
            </div>

            <div className="px-5 sm:px-7 pb-5 sm:pb-7">
              <a
                href="https://laplanetebleue.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 min-h-[44px] text-xs font-semibold text-[#FAF8F5] bg-[#144980] hover:bg-[#030925] rounded-md transition-colors whitespace-nowrap"
              >
                <Radio className="w-4 h-4 text-[#9ECAC2]" />
                <span>{t.home.officialCta}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </article>
        </div>

        {/* Row 2 : Multi-diffusions (5 cols) + Statistiques (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          {/* Bloc 4 : Multi-diffusions */}
          <article className="lg:col-span-5 bg-[#030925] text-[#FAF8F5] border border-[#030925] rounded-xl p-5 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-display font-semibold uppercase tracking-wider text-[#9ECAC2]">
                  {t.home.multiKicker}
                </span>
                <Layers className="w-4 h-4 text-[#9ECAC2]" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white text-balance">
                  {t.home.multiTitle}
                </h2>
                <p className="text-sm text-[#ECE8E1]/85 leading-relaxed">
                  {t.home.multiDesc}
                </p>
              </div>

              {stats && (
                <div className="pt-2">
                  <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-[#9ECAC2]">
                    {formatNum(stats.multi_emission_tracks)}
                  </div>
                  <div className="text-xs text-[#ECE8E1]/70 mt-1">
                    {t.home.multiStatSub}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/15">
              <button
                type="button"
                onClick={() => onNavigate('multi')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 min-h-[44px] text-xs font-bold text-[#030925] bg-[#9ECAC2] hover:bg-[#FAF8F5] rounded-md transition-colors whitespace-nowrap"
              >
                <span>{t.home.multiCta}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>

          {/* Bloc 5 : Statistiques */}
          <article className="lg:col-span-7 bg-[#FAF8F5] border border-[#DDD8D0] rounded-xl p-5 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-display font-semibold uppercase tracking-wider text-[#144980]">
                  {t.home.statsKicker}
                </span>
                <span className="text-xs font-mono tabular-nums text-[#030925]/65">
                  {durationPct}
                  {t.home.statsKnownPct}
                </span>
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#030925] text-balance">
                  {t.home.statsTitle}
                </h2>
                <p className="text-sm sm:text-base text-[#030925]/80 leading-relaxed">
                  {t.home.statsDesc}
                </p>
              </div>

              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#DDD8D0]">
                  <div className="space-y-1.5">
                    <div className="text-xs font-display font-semibold uppercase tracking-wider text-[#030925]/60">
                      {t.home.statsTopAuthors}
                    </div>
                    <div className="divide-y divide-[#DDD8D0]/60">
                      {stats.topAuthors.slice(0, 3).map((author, idx) => (
                        <button
                          key={author.author}
                          type="button"
                          onClick={() => onFilterByAuthor(author.author)}
                          className="w-full min-h-[38px] py-1.5 flex items-center justify-between gap-2 text-left hover:text-[#144980] transition-colors"
                        >
                          <span className="text-xs font-semibold truncate">
                            <span className="font-mono tabular-nums text-[#144980]/70 mr-2">
                              0{idx + 1}
                            </span>
                            {author.author}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-[#030925]/65 shrink-0">
                            {formatNum(author.play_count)} {t.home.statsPlaysAbbr}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-display font-semibold uppercase tracking-wider text-[#030925]/60">
                      {t.home.statsTopCountries}
                    </div>
                    <div className="divide-y divide-[#DDD8D0]/60">
                      {stats.topCountries.slice(0, 3).map((country, idx) => (
                        <button
                          key={country.country}
                          type="button"
                          onClick={() => onFilterByCountry(country.country)}
                          className="w-full min-h-[38px] py-1.5 flex items-center justify-between gap-2 text-left hover:text-[#144980] transition-colors"
                        >
                          <span className="text-xs font-semibold truncate">
                            <span className="font-mono tabular-nums text-[#144980]/70 mr-2">
                              0{idx + 1}
                            </span>
                            {country.country}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-[#030925]/65 shrink-0">
                            {formatNum(country.count)} {t.home.tracksUnit}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#DDD8D0] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onNavigate('stats')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 min-h-[44px] text-xs font-semibold text-[#FAF8F5] bg-[#144980] hover:bg-[#030925] rounded-md transition-colors whitespace-nowrap"
              >
                <BarChart3 className="w-4 h-4 text-[#9ECAC2]" />
                <span>{t.home.statsCta}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
