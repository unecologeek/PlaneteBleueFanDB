import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Pause, Play, Search, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatDuration } from '../types';
import type { EmissionDetailResponse } from '../types';
import { EmissionOrbitalEmblem } from './EmissionOrbitalEmblem';

interface EmissionDrawerProps {
  slug: string | null;
  onClose: () => void;
  onSelectEmission: (slug: string) => void;
  onFilterByAuthor: (author: string) => void;
}

export function EmissionDrawer({
  slug,
  onClose,
  onSelectEmission,
  onFilterByAuthor,
}: EmissionDrawerProps) {
  const { lang, t, formatNum } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const [data, setData] = useState<EmissionDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<number | null>(null);
  const [playingPreviewTrackId, setPlayingPreviewTrackId] = useState<number | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!slug) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/emissions/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(tRef.current.drawer.loadError);
        return (await res.json()) as EmissionDetailResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
      }
    };
  }, [previewAudio]);

  if (!slug) return null;

  const numPrefix = lang === 'en' ? '#' : 'nº ';

  const handleEnrichTrack = async (trackId: number) => {
    setEnrichingId(trackId);
    try {
      const res = await fetch(`/api/tracks/${trackId}/enrich`, { method: 'POST' });
      const result = (await res.json()) as {
        found: boolean;
        duration_sec: number | null;
        duration_source: string | null;
        preview_url: string | null;
      };
      if (result.found && data) {
        setData({
          ...data,
          tracks: data.tracks.map((tr) =>
            tr.track_id === trackId
              ? {
                  ...tr,
                  duration_sec: result.duration_sec,
                  duration_source: result.duration_source,
                  preview_url: result.preview_url,
                }
              : tr
          ),
        });
      }
    } finally {
      setEnrichingId(null);
    }
  };

  const togglePreview = (trackId: number) => {
    if (playingPreviewTrackId === trackId && previewAudio) {
      previewAudio.pause();
      setPlayingPreviewTrackId(null);
      return;
    }
    if (previewAudio) {
      previewAudio.pause();
    }
    const audio = new Audio(`/api/tracks/${trackId}/preview`);
    audio.onended = () => setPlayingPreviewTrackId(null);
    audio.onerror = () => setPlayingPreviewTrackId(null);
    audio.play().catch(() => setPlayingPreviewTrackId(null));
    setPreviewAudio(audio);
    setPlayingPreviewTrackId(trackId);
  };

  const versions = data ? Array.from(new Set(data.tracks.map((tr) => tr.version))) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#030925]/60 backdrop-blur-[1px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.drawer.dialogAria}
    >
      <div
        className="relative w-full max-w-2xl bg-[#ECE8E1] h-full overflow-y-auto border-l border-[#DDD8D0] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header in La Planète Bleue Blue */}
        <div className="sticky top-0 z-10 bg-[#144980] text-[#FAF8F5] border-b border-[#030925]/20 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#9ECAC2]">
              {t.drawer.kicker}
              {data?.emission.broadcast_date_label && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono tabular-nums">{data.emission.broadcast_date_label}</span>
                </>
              )}
            </p>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#FAF8F5] truncate">
              {data ? data.emission.title : `${t.drawer.emissionFallback} ${slug}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-[#ECE8E1]/85 hover:text-white hover:bg-[#030925]/30 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[#9ECAC2]"
            aria-label={t.drawer.closeAria}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1">
          {loading && (
            <div className="flex items-center justify-center py-16 text-[#144980] gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t.drawer.loading}</span>
            </div>
          )}

          {error && (
            <div className="p-4 border border-red-300 bg-red-50 rounded-lg text-sm text-red-900">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg p-4">
                <div className="sm:col-span-4 aspect-[4/3] rounded-md overflow-hidden border border-[#DDD8D0]">
                  <EmissionOrbitalEmblem
                    number={data.emission.number}
                    slug={data.emission.slug}
                  />
                </div>

                <div className="sm:col-span-8 space-y-3">
                  {data.emission.subtitle && (
                    <p className="text-base font-medium text-[#030925] italic">
                      {data.emission.subtitle}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#030925]/75">
                    <span>
                      {t.drawer.broadcastLabel}{' '}
                      <strong className="font-semibold text-[#030925]">
                        {data.emission.broadcast_date_label ||
                          data.emission.broadcast_date ||
                          t.drawer.unknown}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatNum(data.tracks.length)}{' '}
                      {data.tracks.length > 1 ? t.drawer.trackPlural : t.drawer.trackSingular}
                    </span>
                    {data.emission.duration_sec && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {t.drawer.formatLabel} {Math.round(data.emission.duration_sec / 60)} min
                        </span>
                      </>
                    )}
                  </div>

                  {data.emission.description && (
                    <p className="text-sm text-[#030925]/80 leading-relaxed line-clamp-5">
                      {data.emission.description}
                    </p>
                  )}

                  <div className="pt-1 flex flex-wrap items-center gap-4">
                    <a
                      href={data.emission.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#144980] hover:underline whitespace-nowrap"
                    >
                      <span>{t.drawer.officialSheet}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {data.emission.audio_url && (
                <div className="border border-[#DDD8D0] rounded-lg p-4 bg-[#FAF8F5] space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#030925]/75">
                    <span className="font-semibold text-[#030925]">{t.drawer.listenPodcast}</span>
                    <a
                      href={data.emission.audio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#144980] font-semibold hover:underline whitespace-nowrap"
                    >
                      {t.drawer.mp3File}
                    </a>
                  </div>
                  <audio
                    controls
                    preload="none"
                    src={data.emission.audio_url}
                    className="w-full h-10"
                  />
                </div>
              )}

              {/* Iconic Dark Playlist Box inspired by laplanetebleue.com */}
              <div className="space-y-4">
                {versions.map((ver) => {
                  const list = data.tracks.filter((tr) => tr.version === ver);
                  const versionLabel =
                    ver === 'unlimited'
                      ? t.drawer.playlistUnlimited
                      : ver === 'radio'
                        ? t.drawer.playlistRadio
                        : t.drawer.playlistStandard;
                  return (
                    <div key={ver} className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-[#DDD8D0] pb-2">
                        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#030925]">
                          {versionLabel}
                        </h3>
                        <span className="text-xs font-mono tabular-nums text-[#144980]">
                          {formatNum(list.length)}{' '}
                          {list.length > 1 ? t.drawer.trackPlural : t.drawer.trackSingular}
                        </span>
                      </div>

                      <div className="divide-y divide-dotted divide-white/20 rounded-lg bg-[#030925] text-[#FAF8F5] border border-[#030925]">
                        {list.map((track) => (
                          <div
                            key={`${track.version}-${track.position}-${track.track_id}`}
                            className="px-3 sm:px-4 py-3 flex items-start justify-between gap-3 sm:gap-4 hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                              <span className="text-xs font-mono tabular-nums text-[#9ECAC2]/70 pt-1 w-6 shrink-0">
                                {String(track.position).padStart(2, '0')}
                              </span>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-start gap-2">
                                  {track.preview_url && (
                                    <button
                                      type="button"
                                      onClick={() => togglePreview(track.track_id)}
                                      className="w-9 h-9 min-w-[36px] min-h-[36px] -mt-0.5 flex items-center justify-center rounded-md text-[#9ECAC2] bg-white/5 hover:bg-white/15 transition-colors shrink-0"
                                      title={t.drawer.playTitle}
                                      aria-label={`${t.drawer.playAriaPrefix} ${track.title}`}
                                    >
                                      {playingPreviewTrackId === track.track_id ? (
                                        <Pause className="w-4 h-4" />
                                      ) : (
                                        <Play className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  <span className="text-sm font-bold text-white leading-snug break-words">
                                    {track.title}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#ECE8E1]/80">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onFilterByAuthor(track.author);
                                      onClose();
                                    }}
                                    className="font-semibold text-[#9ECAC2] hover:underline text-left uppercase tracking-wide py-0.5"
                                  >
                                    {track.author}
                                  </button>
                                  {track.label && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-[#ECE8E1]/65">({track.label})</span>
                                    </>
                                  )}
                                  {track.country && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="uppercase text-[#ECE8E1]/75">
                                        {track.country}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {track.other_emissions.length > 0 && (
                                  <div className="text-xs text-[#ECE8E1]/60 pt-0.5 flex flex-wrap items-center gap-x-1.5">
                                    <span>{t.drawer.alsoFeaturedIn}</span>
                                    {track.other_emissions.map((other, i) => (
                                      <span key={other.emission_slug}>
                                        {i > 0 && <span aria-hidden="true">, </span>}
                                        <button
                                          type="button"
                                          onClick={() => onSelectEmission(other.emission_slug)}
                                          className="font-mono text-[#9ECAC2] hover:underline py-0.5"
                                        >
                                          {numPrefix}
                                          {other.emission_number ?? other.emission_slug}
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2 pt-0.5">
                              {track.duration_sec ? (
                                <span className="text-xs font-mono tabular-nums text-[#9ECAC2]">
                                  {formatDuration(track.duration_sec)}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={enrichingId === track.track_id}
                                  onClick={() => handleEnrichTrack(track.track_id)}
                                  className="inline-flex items-center gap-1 min-h-[36px] text-xs text-[#ECE8E1]/75 hover:text-[#9ECAC2] px-2.5 py-1.5 rounded border border-white/15 hover:border-[#9ECAC2]/60 transition-colors whitespace-nowrap"
                                  title={t.drawer.durationSearchTitle}
                                >
                                  {enrichingId === track.track_id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Search className="w-3 h-3" />
                                  )}
                                  <span>{t.drawer.durationBtn}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
