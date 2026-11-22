import * as cheerio from 'cheerio';
import {
  db,
  getExistingEmissionSlugs,
  normalizeText,
  rebuildFtsIndex,
  updateTrackDuration,
  upsertEmissionWithTracks,
} from './db.ts';
import type { UpsertEmissionInput, UpsertTrackInput } from './db.ts';

const BASE_URL = 'https://laplanetebleue.com/fr/emissions';
const ALLOWED_SCRAPE_PREFIX = 'https://laplanetebleue.com/fr/emissions/';

const FRENCH_MONTHS: Record<string, string> = {
  janvier: '01',
  janv: '01',
  fevrier: '02',
  février: '02',
  fevr: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  juil: '07',
  aout: '08',
  août: '08',
  septembre: '09',
  sept: '09',
  octobre: '10',
  oct: '10',
  novembre: '11',
  nov: '11',
  decembre: '12',
  décembre: '12',
  dec: '12',
};

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

export const syncStatus: SyncStatus = {
  running: false,
  mode: 'idle',
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  message: 'Prêt',
  startedAt: null,
  finishedAt: null,
};

export function parseFrenchDate(raw: string | null | undefined): {
  iso: string | null;
  label: string | null;
  year: number | null;
} {
  if (!raw) return { iso: null, label: null, year: null };
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/(\d{1,2})(?:er|e|ème)?\s+([a-zA-Zéèêëàâäîïôöùûüç]+)\s+(\d{4})/i);
  if (!match) {
    const yearOnly = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
    return {
      iso: null,
      label: cleaned || null,
      year: yearOnly ? Number(yearOnly[1]) : null,
    };
  }
  const day = match[1].padStart(2, '0');
  const monthKey = match[2].toLowerCase();
  const month = FRENCH_MONTHS[monthKey] || FRENCH_MONTHS[normalizeText(monthKey)];
  const year = Number(match[3]);
  if (!month) {
    return { iso: null, label: `${Number(match[1])} ${match[2]} ${year}`, year };
  }
  return {
    iso: `${year}-${month}-${day}`,
    label: `${Number(match[1]) === 1 ? '1er' : Number(match[1])} ${match[2].toLowerCase()} ${year}`,
    year,
  };
}

function cleanParens(text: string): string | null {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  const unwrapped = trimmed.replace(/^\((.*)\)$/, '$1').trim();
  return unwrapped || null;
}

function extractInlineDuration(text: string): number | null {
  const m = text.match(/(?:^|\s|\(|\[)(\d{1,2}):(\d{2})(?:\)|\]|\s|$)/);
  if (!m) return null;
  const mins = Number(m[1]);
  const secs = Number(m[2]);
  if (secs >= 60 || mins > 120) return null;
  return mins * 60 + secs;
}

function parsePlaylistFromHtml(html: string, version: string): UpsertTrackInput[] {
  const $ = cheerio.load(html);
  const tracks: UpsertTrackInput[] = [];
  let pos = 1;

  // Pattern A: <ol class="font-heading ..."> <li ...>
  const olItems = $('ol.font-heading li');
  if (olItems.length > 0) {
    olItems.each((_, el) => {
      const $li = $(el);
      const author = $li.find('div.uppercase').first().text().replace(/\s+/g, ' ').trim();
      const row = $li.find('div.text-sm').first();
      const title = row.find('span.font-bold').first().text().replace(/\s+/g, ' ').trim();
      const labelRaw = row.find('span.flex-1').first().text();
      const label = cleanParens(labelRaw);
      const countrySpan = row.find('span.uppercase').last();
      const country = countrySpan.length ? countrySpan.text().replace(/\s+/g, ' ').trim() || null : null;

      if (author || title) {
        const inlineDur = extractInlineDuration(title) ?? (label ? extractInlineDuration(label) : null);
        tracks.push({
          author: author || 'Inconnu',
          title: title || 'Sans titre',
          label,
          country,
          duration_sec: inlineDur,
          duration_source: inlineDur ? 'site' : null,
          position: pos++,
          version,
        });
      }
    });
  }

  // Pattern B: <table class="w-full ..."> <tr class="border-dotted ..."> (e.g. emission-1000)
  if (tracks.length === 0) {
    const trItems = $('section table.w-full tr.border-dotted, main table tr.border-dotted');
    trItems.each((_, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 2) {
        const author = $(tds[0]).text().replace(/\s+/g, ' ').trim();
        const title = $(tds[1]).text().replace(/\s+/g, ' ').trim();
        const label = tds.length >= 3 ? cleanParens($(tds[2]).text()) : null;
        const country = tds.length >= 4 ? $(tds[3]).text().replace(/\s+/g, ' ').trim() || null : null;
        if (author || title) {
          const inlineDur = extractInlineDuration(title) ?? (label ? extractInlineDuration(label) : null);
          tracks.push({
            author: author || 'Inconnu',
            title: title || 'Sans titre',
            label,
            country,
            duration_sec: inlineDur,
            duration_source: inlineDur ? 'site' : null,
            position: pos++,
            version,
          });
        }
      }
    });
  }

  return tracks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string, attempt = 0): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'laplanetebleue.com') {
    throw new Error(`Host non autorisé: ${parsed.hostname}`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LaPlaneteBleue-Index/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if ((res.status === 503 || res.status === 429) && attempt < 4) {
      const waitMs = 1500 * Math.pow(2, attempt) + Math.random() * 500;
      await sleep(waitMs);
      return fetchHtml(url, attempt + 1);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} pour ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export interface DiscoveredEmission {
  slug: string;
  url: string;
  number: number | null;
  year: number | null;
  dateLabel: string | null;
}

export async function discoverEmissionsFromIndex(): Promise<DiscoveredEmission[]> {
  const html = await fetchHtml(BASE_URL);
  const $ = cheerio.load(html);
  const bySlug = new Map<string, DiscoveredEmission>();

  $('.swiper-slide').each((_, el) => {
    const $slide = $(el);
    const href = $slide.find('a[href*="/fr/emissions/"]').attr('href')?.trim();
    if (!href || !href.startsWith(ALLOWED_SCRAPE_PREFIX)) return;
    const slug = href.replace(ALLOWED_SCRAPE_PREFIX, '').split('?')[0].replace(/\/+$/, '');
    if (!slug) return;

    const numMatch = slug.match(/(\d+)/);
    const h3Text = $slide.find('h3').text().trim();
    const numFromH3 = h3Text.match(/(\d+)/);
    const number = numFromH3 ? Number(numFromH3[1]) : numMatch ? Number(numMatch[1]) : null;
    const yearAttr = $slide.attr('data-year');
    const year = yearAttr && /^\d{4}$/.test(yearAttr) ? Number(yearAttr) : null;
    const dateLabel = $slide.find('div.bg-black').text().replace(/\s+/g, ' ').trim() || null;

    bySlug.set(slug, {
      slug,
      url: `${ALLOWED_SCRAPE_PREFIX}${slug}`,
      number,
      year,
      dateLabel,
    });
  });

  // Fallback: also check <select> options in case any emission isn't in swiper-slide
  $('select option[value*="/fr/emissions/"]').each((_, el) => {
    const href = $(el).attr('value')?.trim();
    if (!href || !href.startsWith(ALLOWED_SCRAPE_PREFIX)) return;
    const slug = href.replace(ALLOWED_SCRAPE_PREFIX, '').split('?')[0].replace(/\/+$/, '');
    if (!slug || bySlug.has(slug)) return;
    const numMatch = slug.match(/(\d+)/);
    const optgroupYear = $(el).parent('optgroup').attr('label');
    bySlug.set(slug, {
      slug,
      url: `${ALLOWED_SCRAPE_PREFIX}${slug}`,
      number: numMatch ? Number(numMatch[1]) : null,
      year: optgroupYear && /^\d{4}$/.test(optgroupYear) ? Number(optgroupYear) : null,
      dateLabel: null,
    });
  });

  return Array.from(bySlug.values()).sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
}

export async function scrapeSingleEmission(
  discovered: DiscoveredEmission,
  skipFtsUpdate = false
): Promise<number> {
  const html = await fetchHtml(discovered.url);
  const $ = cheerio.load(html);

  const headerText = $('main h2').first().text().replace(/\s+/g, ' ').trim();
  const numMatch = headerText.match(/n[º°]\s*(\d+)/i) || discovered.slug.match(/(\d+)/);
  const number = numMatch ? Number(numMatch[1]) : discovered.number;

  const subtitle =
    $('main .capitalize.italic').first().text().replace(/\s+/g, ' ').trim() || null;

  // Date text from "à partir du 31 octobre 2026"
  const headerDivs = $('main .bg-blue .text-2xl').toArray();
  let rawDateText = discovered.dateLabel || '';
  for (const d of headerDivs) {
    const txt = $(d).text().replace(/\s+/g, ' ').trim();
    if (/à partir du|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|\d{4}/i.test(txt)) {
      rawDateText = txt;
      break;
    }
  }
  const parsedDate = parseFrenchDate(rawDateText || discovered.dateLabel);

  const paragraphs: string[] = [];
  $('main section').first().find('p').each((_, p) => {
    const t = $(p).text().replace(/\s+/g, ' ').trim();
    if (t) paragraphs.push(t);
  });
  const description = paragraphs.join('\n\n') || null;

  const coverUrl =
    $('main section').first().find('figure img').attr('src')?.trim() ||
    $('meta[property="og:image"]').attr('content')?.trim() ||
    null;

  const audioUrl = $('main audio source').attr('src')?.trim() || null;

  const hasUnlimitedLink = $('a[href*="version=unlimited"]').length > 0;
  const primaryVersion = hasUnlimitedLink ? 'radio' : 'standard';
  let tracks = parsePlaylistFromHtml(html, primaryVersion);

  if (hasUnlimitedLink) {
    try {
      const unlimitedHtml = await fetchHtml(`${discovered.url}?version=unlimited`);
      const unlimitedTracks = parsePlaylistFromHtml(unlimitedHtml, 'unlimited');
      if (unlimitedTracks.length > 0) {
        tracks = [...tracks, ...unlimitedTracks];
      }
    } catch {
      // Non-fatal if unlimited variant fails
    }
  }

  // Estimate standard episode duration from emission format if not explicit
  // (Pre-2017 Couleur 3 era ~60 min, 2017+ monthly era ~90 min)
  const inferredEpisodeDuration = number && number >= 946 ? 90 * 60 : 60 * 60;

  const emissionInput: UpsertEmissionInput = {
    number,
    slug: discovered.slug,
    title: number ? `La Planète Bleue nº ${number}` : headerText || discovered.slug,
    subtitle,
    broadcast_date: parsedDate.iso,
    broadcast_date_label: parsedDate.label || discovered.dateLabel,
    year: parsedDate.year ?? discovered.year,
    description,
    cover_url: coverUrl,
    audio_url: audioUrl,
    duration_sec: inferredEpisodeDuration,
    url: discovered.url,
  };

  upsertEmissionWithTracks(emissionInput, tracks, skipFtsUpdate);
  return tracks.length;
}

export async function runCrawlSync(options?: { full?: boolean; concurrency?: number }): Promise<void> {
  if (syncStatus.running) {
    throw new Error('Une synchronisation est déjà en cours.');
  }

  syncStatus.running = true;
  syncStatus.mode = 'crawl';
  syncStatus.processed = 0;
  syncStatus.succeeded = 0;
  syncStatus.failed = 0;
  syncStatus.startedAt = new Date().toISOString();
  syncStatus.finishedAt = null;
  syncStatus.message = 'Découverte de la liste des émissions sur laplanetebleue.com…';

  try {
    const allDiscovered = await discoverEmissionsFromIndex();
    const existing = options?.full ? new Set<string>() : getExistingEmissionSlugs();
    const queue = allDiscovered.filter((item) => !existing.has(item.slug));

    syncStatus.total = queue.length;
    if (queue.length === 0) {
      syncStatus.message = `Toutes les ${allDiscovered.length} émissions sont déjà indexées.`;
      syncStatus.running = false;
      syncStatus.mode = 'idle';
      syncStatus.finishedAt = new Date().toISOString();
      return;
    }

    syncStatus.message = `Indexation de ${queue.length} émission(s)…`;
    const concurrency = Math.min(8, Math.max(1, options?.concurrency ?? 4));
    let idx = 0;

    async function worker() {
      while (idx < queue.length) {
        const current = queue[idx++];
        try {
          await scrapeSingleEmission(current, true);
          syncStatus.succeeded++;
        } catch {
          syncStatus.failed++;
        } finally {
          syncStatus.processed++;
          syncStatus.message = `Indexation : ${syncStatus.processed} / ${syncStatus.total} émissions (${syncStatus.succeeded} OK)`;
          await sleep(120);
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    syncStatus.message = 'Reconstruction de l’index plein texte…';
    rebuildFtsIndex();
    syncStatus.message = `Terminé : ${syncStatus.succeeded} émission(s) indexée(s).`;
  } finally {
    syncStatus.running = false;
    syncStatus.mode = 'idle';
    syncStatus.finishedAt = new Date().toISOString();
  }
}

function similarityScore(queryAuthor: string, queryTitle: string, candAuthor: string, candTitle: string): number {
  const qa = normalizeText(queryAuthor);
  const qt = normalizeText(queryTitle);
  const ca = normalizeText(candAuthor);
  const ct = normalizeText(candTitle);

  const authorMatch = ca === qa || ca.includes(qa) || qa.includes(ca);
  const titleClean = qt.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
  const candTitleClean = ct.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
  const titleMatch =
    ct === qt ||
    candTitleClean === titleClean ||
    (titleClean.length >= 3 && (candTitleClean.includes(titleClean) || titleClean.includes(candTitleClean)));

  if (authorMatch && titleMatch) return 2;
  if (titleMatch && qa.split(' ').some((w) => w.length >= 3 && ca.includes(w))) return 1;
  return 0;
}

export async function lookupItunesPreview(
  author: string,
  title: string
): Promise<{ durationSec: number; source: 'itunes'; previewUrl: string | null } | null> {
  const cleanTitle = title.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanAuthor = author.replace(/\s+/g, ' ').trim();
  const queryStr = `${cleanAuthor} ${cleanTitle}`.trim();
  if (!queryStr) return null;

  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(queryStr)}&media=music&limit=5`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const json = (await res.json()) as {
        results?: Array<{
          artistName?: string;
          trackName?: string;
          trackTimeMillis?: number;
          previewUrl?: string;
        }>;
      };
      let best: { score: number; duration: number; preview: string | null } | null = null;
      for (const item of json.results ?? []) {
        if (!item.trackTimeMillis || item.trackTimeMillis <= 0) continue;
        const score = similarityScore(cleanAuthor, cleanTitle, item.artistName ?? '', item.trackName ?? '');
        if (score > 0 && (!best || score > best.score)) {
          best = {
            score,
            duration: Math.round(item.trackTimeMillis / 1000),
            preview: item.previewUrl || null,
          };
        }
      }
      if (best) {
        return { durationSec: best.duration, source: 'itunes', previewUrl: best.preview };
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

export async function lookupTrackDuration(
  author: string,
  title: string
): Promise<{ durationSec: number; source: 'deezer' | 'itunes'; previewUrl: string | null } | null> {
  const cleanTitle = title.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanAuthor = author.replace(/\s+/g, ' ').trim();
  const queryStr = `${cleanAuthor} ${cleanTitle}`.trim();
  if (!queryStr) return null;

  // 1. Try Deezer API
  try {
    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(queryStr)}&limit=5`;
    const res = await fetch(deezerUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{
          title?: string;
          duration?: number;
          preview?: string;
          artist?: { name?: string };
        }>;
      };
      let best: { score: number; duration: number; preview: string | null } | null = null;
      for (const item of json.data ?? []) {
        if (!item.duration || item.duration <= 0) continue;
        const score = similarityScore(cleanAuthor, cleanTitle, item.artist?.name ?? '', item.title ?? '');
        if (score > 0 && (!best || score > best.score)) {
          best = { score, duration: item.duration, preview: item.preview || null };
        }
      }
      if (best) {
        return { durationSec: best.duration, source: 'deezer', previewUrl: best.preview };
      }
    }
  } catch {
    // Fall through to iTunes
  }

  // 2. Try iTunes Search API
  return lookupItunesPreview(author, title);
}

export async function enrichTrackById(trackId: number): Promise<{
  found: boolean;
  duration_sec: number | null;
  duration_source: string | null;
  preview_url: string | null;
}> {
  const row = db
    .prepare(`SELECT id, author, title, duration_sec, duration_source, preview_url FROM tracks WHERE id = ?`)
    .get(trackId) as
    | {
        id: number;
        author: string;
        title: string;
        duration_sec: number | null;
        duration_source: string | null;
        preview_url: string | null;
      }
    | undefined;

  if (!row) {
    throw new Error('Titre introuvable');
  }

  const result = await lookupTrackDuration(row.author, row.title);
  if (!result) {
    return {
      found: false,
      duration_sec: row.duration_sec,
      duration_source: row.duration_source,
      preview_url: row.preview_url,
    };
  }

  updateTrackDuration(trackId, result.durationSec, result.source, result.previewUrl);
  return {
    found: true,
    duration_sec: result.durationSec,
    duration_source: result.source,
    preview_url: result.previewUrl,
  };
}

export async function runBatchDurationEnrichment(limitCount = 200): Promise<void> {
  if (syncStatus.running) {
    throw new Error('Une tâche est déjà en cours.');
  }

  const pending = db
    .prepare(
      `
      SELECT t.id, t.author, t.title
      FROM tracks t
      INNER JOIN track_appearances ta ON ta.track_id = t.id
      WHERE t.duration_sec IS NULL
      GROUP BY t.id
      ORDER BY MAX(COALESCE(ta.broadcast_date, '')) DESC, t.id DESC
      LIMIT ?
    `
    )
    .all(Math.min(1000, Math.max(1, limitCount))) as Array<{ id: number; author: string; title: string }>;

  syncStatus.running = true;
  syncStatus.mode = 'enrich';
  syncStatus.total = pending.length;
  syncStatus.processed = 0;
  syncStatus.succeeded = 0;
  syncStatus.failed = 0;
  syncStatus.startedAt = new Date().toISOString();
  syncStatus.finishedAt = null;
  syncStatus.message = `Recherche de durées pour ${pending.length} titres…`;

  try {
    let idx = 0;
    const concurrency = 6;

    async function worker() {
      while (idx < pending.length) {
        const track = pending[idx++];
        try {
          const found = await lookupTrackDuration(track.author, track.title);
          if (found) {
            updateTrackDuration(track.id, found.durationSec, found.source, found.previewUrl);
            syncStatus.succeeded++;
          } else {
            syncStatus.failed++;
          }
        } catch {
          syncStatus.failed++;
        } finally {
          syncStatus.processed++;
          syncStatus.message = `Durées : ${syncStatus.processed} / ${syncStatus.total} (${syncStatus.succeeded} trouvées)`;
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    syncStatus.message = `Enrichissement terminé : ${syncStatus.succeeded} durées ajoutées.`;
  } finally {
    syncStatus.running = false;
    syncStatus.mode = 'idle';
    syncStatus.finishedAt = new Date().toISOString();
  }
}
