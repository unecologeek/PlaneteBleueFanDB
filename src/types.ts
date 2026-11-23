export interface TrackAppearanceInfo {
  emission_id: number;
  emission_number: number | null;
  emission_slug: string;
  emission_title: string;
  emission_url: string;
  broadcast_date: string | null;
  broadcast_date_label: string | null;
  position: number;
  version: string;
  label: string | null;
  country: string | null;
}

export interface TrackSearchItem {
  id: number;
  title: string;
  author: string;
  label: string | null;
  country: string | null;
  duration_sec: number | null;
  duration_source: string | null;
  preview_url: string | null;
  appearance_count: number;
  first_broadcast_date: string | null;
  last_broadcast_date: string | null;
  appearances: TrackAppearanceInfo[];
}

export interface EmissionRecord {
  id: number;
  number: number | null;
  slug: string;
  title: string;
  subtitle: string | null;
  broadcast_date: string | null;
  broadcast_date_label: string | null;
  year: number | null;
  description: string | null;
  cover_url: string | null;
  audio_url: string | null;
  has_audio?: boolean;
  duration_sec: number | null;
  url: string;
  track_count: number;
  scraped_at: string;
}

export interface EmissionDetailResponse {
  emission: EmissionRecord;
  tracks: Array<{
    track_id: number;
    position: number;
    version: string;
    title: string;
    author: string;
    label: string | null;
    country: string | null;
    duration_sec: number | null;
    duration_source: string | null;
    preview_url: string | null;
    other_emissions: Array<{
      emission_number: number | null;
      emission_slug: string;
      broadcast_date_label: string | null;
    }>;
  }>;
}

export interface SyncStatus {
  running: boolean;
  mode: 'idle' | 'crawl' | 'enrich';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ArchiveStats {
  emissions_count: number;
  tracks_count: number;
  appearances_count: number;
  tracks_with_duration: number;
  multi_emission_tracks: number;
  min_date: string | null;
  max_date: string | null;
  total_known_duration_sec: number | null;
  years: Array<{ year: number; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  topAuthors: Array<{ author: string; emission_count: number; play_count: number }>;
  syncStatus: SyncStatus;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatNumberFR(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  return new Intl.NumberFormat('fr-FR').format(n);
}

export interface GlobeTrackSample {
  id: number;
  title: string;
  author: string;
  duration_sec: number | null;
  preview_url: string | null;
  country: string | null;
  emission_number: number | null;
  emission_slug: string;
  broadcast_date_label: string | null;
  appearance_count: number;
}

export interface GlobeCountryBucket {
  isoId: string;
  nameFr: string;
  lat: number;
  lng: number;
  trackCount: number;
  playCount: number;
  topAuthors: string[];
  sampleTracks: GlobeTrackSample[];
}

export interface GlobeArc {
  fromIso: string;
  toIso: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  weight: number;
  kind?: 'collab' | 'playlist';
  emissions?: Array<{
    number: number | null;
    slug: string;
  }>;
}

export interface GlobeResponse {
  countries: GlobeCountryBucket[];
  arcs: GlobeArc[];
  matchedTracksCount: number;
  matchedCountriesCount: number;
  catalog: Array<{
    isoId: string;
    nameFr: string;
    lat: number;
    lng: number;
  }>;
}

