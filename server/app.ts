import dotenv from 'dotenv';
import express from 'express';
import { Readable } from 'node:stream';
import {
  enrichTrackById,
  lookupItunesPreview,
  lookupTrackDuration,
  runBatchDurationEnrichment,
  runCrawlSync,
  syncStatus,
} from './crawler.ts';
import {
  db,
  getAuthorsRanking,
  getCountriesRanking,
  getEmissionDetail,
  getStats,
  getTopTracksRanking,
  getYearsRanking,
  isServerlessEnv,
  listEmissions,
  searchTracks,
  updateTrackDuration,
  updateTrackPreviewUrl,
} from './db.ts';
import { queryGlobeData, resolveMatchingCountryStrings } from './geo.ts';

dotenv.config();

function isAllowedPreviewUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'cdnt-preview.dzcdn.net' ||
      /^cdns-preview-[0-9a-z-]+\.dzcdn\.net$/i.test(host) ||
      host === 'audio-ssl.itunes.apple.com' ||
      host === 'p.scdn.co'
    );
  } catch {
    return false;
  }
}

async function fetchAllowedAudioResponse(
  rawUrl: string,
  rangeHeader?: string
): Promise<Response | null> {
  if (!isAllowedPreviewUrl(rawUrl)) return null;
  let currentUrl = rawUrl;
  for (let hops = 0; hops < 3; hops++) {
    const headers: Record<string, string> = {};
    if (rangeHeader && /^bytes=\d*-\d*$/i.test(rangeHeader.trim())) {
      headers.Range = rangeHeader.trim();
    }
    const res = await fetch(currentUrl, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isAllowedPreviewUrl(nextUrl)) return null;
      currentUrl = nextUrl;
      continue;
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const isAudio =
      ct.startsWith('audio/') ||
      (ct === 'application/octet-stream' && /\.(mp3|m4a|mp4|aac|ogg)(\?|$)/i.test(currentUrl));
    if ((res.status === 200 || res.status === 206) && isAudio && res.body) {
      return res;
    }
    try {
      await res.body?.cancel();
    } catch {
      // Ignore cancel error
    }
    return null;
  }
  return null;
}

function parseIntParam(val: unknown): number | null {
  if (typeof val !== 'string' || !val.trim()) return null;
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function csvEscape(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDurationMMSS(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/stats', (_req, res) => {
    try {
      const stats = getStats();
      res.json({ ...stats, syncStatus });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/stats/authors', (req, res) => {
    try {
      const offset = parseIntParam(req.query.offset) ?? 0;
      const limit = parseIntParam(req.query.limit) ?? 25;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      res.json(getAuthorsRanking({ offset, limit, q }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/stats/countries', (req, res) => {
    try {
      const offset = parseIntParam(req.query.offset) ?? 0;
      const limit = parseIntParam(req.query.limit) ?? 25;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      res.json(getCountriesRanking({ offset, limit, q }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/stats/top-tracks', (req, res) => {
    try {
      const offset = parseIntParam(req.query.offset) ?? 0;
      const limit = parseIntParam(req.query.limit) ?? 25;
      res.json(getTopTracksRanking({ offset, limit }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/stats/years', (req, res) => {
    try {
      const offset = parseIntParam(req.query.offset) ?? 0;
      const limit = parseIntParam(req.query.limit) ?? 15;
      res.json(getYearsRanking({ offset, limit }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/globe', (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const year = parseIntParam(req.query.year);
      const multiOnly = req.query.multiOnly === 'true';
      res.json(queryGlobeData({ q, year, multiOnly }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/tracks', (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const author = typeof req.query.author === 'string' ? req.query.author : undefined;
      const country = typeof req.query.country === 'string' ? req.query.country : undefined;
      const year = parseIntParam(req.query.year);
      const emission = parseIntParam(req.query.emission);
      const multiOnly = req.query.multiOnly === 'true';
      const hasDurationRaw = typeof req.query.hasDuration === 'string' ? req.query.hasDuration : 'all';
      const hasDuration =
        hasDurationRaw === 'known' || hasDurationRaw === 'missing' ? hasDurationRaw : 'all';
      const minDuration = parseIntParam(req.query.minDuration);
      const maxDuration = parseIntParam(req.query.maxDuration);
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'latest';
      const page = parseIntParam(req.query.page) ?? 1;
      const limit = parseIntParam(req.query.limit) ?? 50;

      const countryExactList = country ? resolveMatchingCountryStrings(country) : null;

      const result = searchTracks({
        q,
        author,
        country,
        countryExactList,
        year,
        emission,
        multiOnly,
        hasDuration,
        minDuration,
        maxDuration,
        sort,
        page,
        limit,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/export.csv', (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const author = typeof req.query.author === 'string' ? req.query.author : undefined;
      const country = typeof req.query.country === 'string' ? req.query.country : undefined;
      const year = parseIntParam(req.query.year);
      const emission = parseIntParam(req.query.emission);
      const multiOnly = req.query.multiOnly === 'true';
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'latest';
      const countryExactList = country ? resolveMatchingCountryStrings(country) : null;

      const result = searchTracks({
        q,
        author,
        country,
        countryExactList,
        year,
        emission,
        multiOnly,
        sort,
        page: 1,
        limit: 5000,
      });

      const header = [
        'Titre',
        'Auteur',
        'Durée',
        'Label',
        'Pays',
        'Nombre d’émissions',
        'Émissions & Dates de diffusion',
      ].join(';');

      const lines = result.items.map((item) => {
        const diffusions = item.appearances
          .map(
            (a) =>
              `nº ${a.emission_number ?? a.emission_slug} (${a.broadcast_date_label || a.broadcast_date || 'Date inconnue'}${a.version !== 'standard' ? ` - ${a.version}` : ''})`
          )
          .join(' | ');
        return [
          csvEscape(item.title),
          csvEscape(item.author),
          csvEscape(formatDurationMMSS(item.duration_sec)),
          csvEscape(item.label),
          csvEscape(item.country),
          csvEscape(item.appearance_count),
          csvEscape(diffusions),
        ].join(';');
      });

      const csv = '\uFEFF' + [header, ...lines].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="la-planete-bleue-titres.csv"');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/emissions', (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const year = parseIntParam(req.query.year);
      const page = parseIntParam(req.query.page) ?? 1;
      const limit = parseIntParam(req.query.limit) ?? 24;
      const data = listEmissions({ q, year, page, limit });
      res.json({
        ...data,
        items: data.items.map(({ cover_url: _omit, ...rest }) => ({ ...rest, cover_url: null })),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/emissions/:slug', (req, res) => {
    try {
      const detail = getEmissionDetail(req.params.slug);
      if (!detail) {
        res.status(404).json({ error: 'Émission introuvable' });
        return;
      }
      const { cover_url: _omit, ...restEmission } = detail.emission;
      res.json({
        ...detail,
        emission: { ...restEmission, cover_url: null },
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/tracks/:id/preview', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'ID invalide' });
        return;
      }

      const row = db
        .prepare(`SELECT id, author, title, preview_url, duration_sec FROM tracks WHERE id = ?`)
        .get(id) as
        | {
            id: number;
            author: string;
            title: string;
            preview_url: string | null;
            duration_sec: number | null;
          }
        | undefined;

      if (!row) {
        res.status(404).json({ error: 'Titre introuvable' });
        return;
      }

      const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
      let upstream = row.preview_url
        ? await fetchAllowedAudioResponse(row.preview_url, rangeHeader)
        : null;

      // Refresh expired signed preview URLs (e.g. Deezer hdnea tokens) or fallback to iTunes
      if (!upstream) {
        const fresh = await lookupTrackDuration(row.author, row.title);
        if (fresh?.previewUrl && fresh.previewUrl !== row.preview_url) {
          upstream = await fetchAllowedAudioResponse(fresh.previewUrl, rangeHeader);
          if (upstream) {
            if (row.duration_sec === null) {
              updateTrackDuration(id, fresh.durationSec, fresh.source, fresh.previewUrl);
            } else {
              updateTrackPreviewUrl(id, fresh.previewUrl);
            }
          }
        }

        if (!upstream) {
          const itunes = await lookupItunesPreview(row.author, row.title);
          if (itunes?.previewUrl) {
            upstream = await fetchAllowedAudioResponse(itunes.previewUrl, rangeHeader);
            if (upstream) {
              updateTrackPreviewUrl(id, itunes.previewUrl);
            }
          }
        }
      }

      if (!upstream || !upstream.body) {
        res.status(404).json({ error: 'Extrait audio indisponible pour ce titre' });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
      const contentLength = upstream.headers.get('content-length');
      const contentRange = upstream.headers.get('content-range');
      const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      res.setHeader('Accept-Ranges', acceptRanges);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

      const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
      res.on('close', () => {
        nodeStream.destroy();
      });
      nodeStream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      });
      nodeStream.pipe(res);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  app.post('/api/tracks/:id/enrich', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'ID invalide' });
        return;
      }
      const result = await enrichTrackById(id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/tracks/:id/duration', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'ID invalide' });
        return;
      }
      const rawDuration = req.body?.duration_sec;
      let durationSec: number | null = null;
      if (rawDuration !== null && rawDuration !== undefined && rawDuration !== '') {
        if (typeof rawDuration === 'string' && /^\d{1,3}:\d{2}$/.test(rawDuration.trim())) {
          const [m, s] = rawDuration.trim().split(':').map(Number);
          if (s >= 60) {
            res.status(400).json({ error: 'Secondes invalides (00-59)' });
            return;
          }
          durationSec = m * 60 + s;
        } else if (
          typeof rawDuration === 'number' &&
          Number.isFinite(rawDuration) &&
          rawDuration > 0 &&
          rawDuration <= 36000
        ) {
          durationSec = Math.round(rawDuration);
        } else {
          res.status(400).json({ error: 'Format de durée invalide (attendu mm:ss ou secondes)' });
          return;
        }
      }
      updateTrackDuration(id, durationSec, 'manual');
      res.json({ ok: true, duration_sec: durationSec, duration_source: 'manual' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/sync/status', (_req, res) => {
    res.json(syncStatus);
  });

  app.post('/api/sync', (req, res) => {
    if (isServerlessEnv) {
      res.json({
        started: false,
        syncStatus: {
          ...syncStatus,
          running: false,
          mode: 'idle',
          message: 'Environnement Vercel : base pré-indexée embarquée.',
        },
      });
      return;
    }
    if (syncStatus.running) {
      res.status(409).json({ error: 'Synchronisation déjà en cours', syncStatus });
      return;
    }
    const full = Boolean(req.body?.full);
    runCrawlSync({ full }).catch((err) => {
      console.error('Crawl sync error:', err);
    });
    res.json({ started: true, syncStatus });
  });

  app.post('/api/enrich-batch', (req, res) => {
    if (isServerlessEnv) {
      res.json({
        started: false,
        syncStatus: {
          ...syncStatus,
          running: false,
          mode: 'idle',
          message: 'Enrichissement par lot désactivé sur Vercel (utilisez les boutons par titre).',
        },
      });
      return;
    }
    if (syncStatus.running) {
      res.status(409).json({ error: 'Une tâche est déjà en cours', syncStatus });
      return;
    }
    const limit = parseIntParam(String(req.body?.limit ?? '250')) ?? 250;
    runBatchDurationEnrichment(limit).catch((err) => {
      console.error('Batch enrich error:', err);
    });
    res.json({ started: true, syncStatus });
  });

  return app;
}
