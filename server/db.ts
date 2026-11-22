import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  duration_sec: number | null;
  url: string;
  track_count: number;
  scraped_at: string;
}

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

export interface UpsertTrackInput {
  title: string;
  author: string;
  label: string | null;
  country: string | null;
  duration_sec: number | null;
  duration_source: string | null;
  position: number;
  version: string;
}

export interface UpsertEmissionInput {
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
  duration_sec: number | null;
  url: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const isServerlessEnv = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME
);

function isDirWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveDbPath(): string {
  const localDataDir = path.resolve(process.cwd(), 'data');
  const candidateDbPaths = [
    path.join(localDataDir, 'planete_bleue.db'),
    path.resolve(__dirname, '../data/planete_bleue.db'),
    path.resolve(__dirname, '../../data/planete_bleue.db'),
  ];

  if (!isServerlessEnv && isDirWritable(localDataDir)) {
    return path.join(localDataDir, 'planete_bleue.db');
  }

  // On Vercel/serverless, /var/task is read-only; copy bundled DB into writable /tmp on cold start
  const tmpDbPath = '/tmp/planete_bleue.db';
  const bundledDbPath = candidateDbPaths.find((p) => fs.existsSync(p));
  if (bundledDbPath && !fs.existsSync(tmpDbPath)) {
    const tmpStagePath = `${tmpDbPath}.${process.pid}.tmp`;
    fs.copyFileSync(bundledDbPath, tmpStagePath);
    fs.renameSync(tmpStagePath, tmpDbPath);
  }
  return tmpDbPath;
}

const DB_PATH = resolveDbPath();
export const db = new Database(DB_PATH);

db.pragma('busy_timeout = 5000');
db.pragma('journal_mode = DELETE');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS emissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER UNIQUE,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    broadcast_date TEXT,
    broadcast_date_label TEXT,
    year INTEGER,
    description TEXT,
    cover_url TEXT,
    audio_url TEXT,
    duration_sec INTEGER,
    url TEXT NOT NULL,
    track_count INTEGER DEFAULT 0,
    scraped_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    norm_key TEXT UNIQUE NOT NULL,
    label TEXT,
    country TEXT,
    duration_sec INTEGER,
    duration_source TEXT,
    preview_url TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS track_appearances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    emission_id INTEGER NOT NULL REFERENCES emissions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    version TEXT NOT NULL DEFAULT 'standard',
    label TEXT,
    country TEXT,
    broadcast_date TEXT,
    broadcast_date_label TEXT,
    UNIQUE(track_id, emission_id, position, version)
  );

  CREATE INDEX IF NOT EXISTS idx_emissions_number ON emissions(number);
  CREATE INDEX IF NOT EXISTS idx_emissions_year ON emissions(year);
  CREATE INDEX IF NOT EXISTS idx_emissions_date ON emissions(broadcast_date);
  CREATE INDEX IF NOT EXISTS idx_tracks_norm ON tracks(norm_key);
  CREATE INDEX IF NOT EXISTS idx_tracks_author ON tracks(author);
  CREATE INDEX IF NOT EXISTS idx_tracks_duration ON tracks(duration_sec);
  CREATE INDEX IF NOT EXISTS idx_app_track ON track_appearances(track_id);
  CREATE INDEX IF NOT EXISTS idx_app_emission ON track_appearances(emission_id);
  CREATE INDEX IF NOT EXISTS idx_app_date ON track_appearances(broadcast_date);

  CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
    track_id UNINDEXED,
    title,
    author,
    label,
    country,
    emission_numbers,
    broadcast_dates,
    tokenize="unicode61 remove_diacritics 2"
  );
`);

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, "'")
    .replace(/[^a-z0-9'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTrackKey(author: string, title: string): string {
  return `${normalizeText(author)}::${normalizeText(title)}`;
}

const stmtUpsertEmission = db.prepare(`
  INSERT INTO emissions (
    number, slug, title, subtitle, broadcast_date, broadcast_date_label,
    year, description, cover_url, audio_url, duration_sec, url, track_count, scraped_at
  ) VALUES (
    @number, @slug, @title, @subtitle, @broadcast_date, @broadcast_date_label,
    @year, @description, @cover_url, @audio_url, @duration_sec, @url, @track_count, @scraped_at
  )
  ON CONFLICT(slug) DO UPDATE SET
    number = COALESCE(excluded.number, emissions.number),
    title = excluded.title,
    subtitle = COALESCE(excluded.subtitle, emissions.subtitle),
    broadcast_date = COALESCE(excluded.broadcast_date, emissions.broadcast_date),
    broadcast_date_label = COALESCE(excluded.broadcast_date_label, emissions.broadcast_date_label),
    year = COALESCE(excluded.year, emissions.year),
    description = COALESCE(excluded.description, emissions.description),
    cover_url = COALESCE(excluded.cover_url, emissions.cover_url),
    audio_url = COALESCE(excluded.audio_url, emissions.audio_url),
    duration_sec = COALESCE(excluded.duration_sec, emissions.duration_sec),
    url = excluded.url,
    track_count = excluded.track_count,
    scraped_at = excluded.scraped_at
  RETURNING id
`);

const stmtFindTrackByKey = db.prepare(`SELECT id, label, country, duration_sec, duration_source FROM tracks WHERE norm_key = ?`);

const stmtInsertTrack = db.prepare(`
  INSERT INTO tracks (title, author, norm_key, label, country, duration_sec, duration_source, preview_url, updated_at)
  VALUES (@title, @author, @norm_key, @label, @country, @duration_sec, @duration_source, NULL, @updated_at)
  RETURNING id
`);

const stmtUpdateTrackMeta = db.prepare(`
  UPDATE tracks SET
    label = COALESCE(label, @label),
    country = COALESCE(country, @country),
    duration_sec = COALESCE(duration_sec, @duration_sec),
    duration_source = COALESCE(duration_source, @duration_source),
    updated_at = @updated_at
  WHERE id = @id
`);

const stmtDeleteEmissionAppearances = db.prepare(`DELETE FROM track_appearances WHERE emission_id = ?`);

const stmtInsertAppearance = db.prepare(`
  INSERT OR IGNORE INTO track_appearances (
    track_id, emission_id, position, version, label, country, broadcast_date, broadcast_date_label
  ) VALUES (
    @track_id, @emission_id, @position, @version, @label, @country, @broadcast_date, @broadcast_date_label
  )
`);

const stmtDeleteFtsForTrack = db.prepare(`DELETE FROM tracks_fts WHERE track_id = ?`);
const stmtInsertFts = db.prepare(`
  INSERT INTO tracks_fts (track_id, title, author, label, country, emission_numbers, broadcast_dates)
  SELECT
    t.id,
    t.title,
    t.author,
    COALESCE(GROUP_CONCAT(DISTINCT ta.label), t.label, ''),
    COALESCE(GROUP_CONCAT(DISTINCT ta.country), t.country, ''),
    COALESCE(GROUP_CONCAT(DISTINCT CAST(e.number AS TEXT)), ''),
    COALESCE(GROUP_CONCAT(DISTINCT COALESCE(ta.broadcast_date_label, '') || ' ' || COALESCE(ta.broadcast_date, '')), '')
  FROM tracks t
  LEFT JOIN track_appearances ta ON ta.track_id = t.id
  LEFT JOIN emissions e ON e.id = ta.emission_id
  WHERE t.id = ?
  GROUP BY t.id
`);

export const upsertEmissionWithTracks = db.transaction(
  (emission: UpsertEmissionInput, tracksList: UpsertTrackInput[], skipFtsUpdate = false): number => {
    const now = new Date().toISOString();
    const uniqueCount = tracksList.length;
    const row = stmtUpsertEmission.get({
      ...emission,
      track_count: uniqueCount,
      scraped_at: now,
    }) as { id: number };
    const emissionId = row.id;

    stmtDeleteEmissionAppearances.run(emissionId);

    const touchedTrackIds = new Set<number>();

    for (const item of tracksList) {
      const cleanTitle = item.title.trim();
      const cleanAuthor = item.author.trim();
      if (!cleanTitle && !cleanAuthor) continue;

      const normKey = normalizeTrackKey(cleanAuthor || 'Inconnu', cleanTitle || 'Sans titre');
      let existing = stmtFindTrackByKey.get(normKey) as
        | { id: number; label: string | null; country: string | null; duration_sec: number | null; duration_source: string | null }
        | undefined;

      let trackId: number;
      if (!existing) {
        const inserted = stmtInsertTrack.get({
          title: cleanTitle || 'Sans titre',
          author: cleanAuthor || 'Inconnu',
          norm_key: normKey,
          label: item.label,
          country: item.country,
          duration_sec: item.duration_sec,
          duration_source: item.duration_source,
          updated_at: now,
        }) as { id: number };
        trackId = inserted.id;
      } else {
        trackId = existing.id;
        if (
          (!existing.label && item.label) ||
          (!existing.country && item.country) ||
          (!existing.duration_sec && item.duration_sec)
        ) {
          stmtUpdateTrackMeta.run({
            id: trackId,
            label: item.label,
            country: item.country,
            duration_sec: item.duration_sec,
            duration_source: item.duration_source,
            updated_at: now,
          });
        }
      }

      stmtInsertAppearance.run({
        track_id: trackId,
        emission_id: emissionId,
        position: item.position,
        version: item.version,
        label: item.label,
        country: item.country,
        broadcast_date: emission.broadcast_date,
        broadcast_date_label: emission.broadcast_date_label,
      });

      touchedTrackIds.add(trackId);
    }

    if (!skipFtsUpdate) {
      for (const trackId of touchedTrackIds) {
        stmtDeleteFtsForTrack.run(trackId);
        stmtInsertFts.run(trackId);
      }
    }

    return emissionId;
  }
);

export const rebuildFtsIndex = db.transaction(() => {
  db.exec(`DELETE FROM tracks_fts`);
  db.exec(`
    INSERT INTO tracks_fts (track_id, title, author, label, country, emission_numbers, broadcast_dates)
    SELECT
      t.id,
      t.title,
      t.author,
      COALESCE(GROUP_CONCAT(DISTINCT ta.label), t.label, ''),
      COALESCE(GROUP_CONCAT(DISTINCT ta.country), t.country, ''),
      COALESCE(GROUP_CONCAT(DISTINCT CAST(e.number AS TEXT)), ''),
      COALESCE(GROUP_CONCAT(DISTINCT COALESCE(ta.broadcast_date_label, '') || ' ' || COALESCE(ta.broadcast_date, '')), '')
    FROM tracks t
    LEFT JOIN track_appearances ta ON ta.track_id = t.id
    LEFT JOIN emissions e ON e.id = ta.emission_id
    GROUP BY t.id
  `);
});

function buildFtsQuery(raw: string): string | null {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((tok) => `"${tok}"*`).join(' AND ');
}

export interface TrackSearchParams {
  q?: string;
  author?: string;
  country?: string;
  countryExactList?: string[] | null;
  year?: number | null;
  emission?: number | null;
  multiOnly?: boolean;
  hasDuration?: 'all' | 'known' | 'missing';
  minDuration?: number | null;
  maxDuration?: number | null;
  sort?: string;
  page?: number;
  limit?: number;
}

export function searchTracks(params: TrackSearchParams): {
  items: TrackSearchItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(200, Math.max(1, params.limit || 50));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const havingClauses: string[] = [];
  const bindParams: Record<string, string | number> = {};

  const ftsExpr = params.q ? buildFtsQuery(params.q) : null;
  let joinFts = '';
  if (ftsExpr) {
    joinFts = `INNER JOIN tracks_fts fts ON fts.track_id = t.id`;
    whereClauses.push(`tracks_fts MATCH @ftsExpr`);
    bindParams.ftsExpr = ftsExpr;
  }

  if (params.author && params.author.trim()) {
    whereClauses.push(`LOWER(t.author) LIKE @authorPattern`);
    bindParams.authorPattern = `%${params.author.trim().toLowerCase()}%`;
  }

  if (params.countryExactList && params.countryExactList.length > 0) {
    const placeholders = params.countryExactList.map((_, idx) => `@cExact${idx}`);
    params.countryExactList.forEach((val, idx) => {
      bindParams[`cExact${idx}`] = val;
    });
    whereClauses.push(`(COALESCE(ta.country, t.country, '') IN (${placeholders.join(', ')}))`);
  } else if (params.countryExactList && params.countryExactList.length === 0) {
    whereClauses.push(`1 = 0`);
  } else if (params.country && params.country.trim()) {
    whereClauses.push(`(LOWER(COALESCE(ta.country, t.country, '')) LIKE @countryPattern)`);
    bindParams.countryPattern = `%${params.country.trim().toLowerCase()}%`;
  }

  if (params.year) {
    whereClauses.push(`e.year = @year`);
    bindParams.year = params.year;
  }

  if (params.emission) {
    whereClauses.push(`e.number = @emission`);
    bindParams.emission = params.emission;
  }

  if (params.hasDuration === 'known') {
    whereClauses.push(`t.duration_sec IS NOT NULL AND t.duration_sec > 0`);
  } else if (params.hasDuration === 'missing') {
    whereClauses.push(`(t.duration_sec IS NULL OR t.duration_sec <= 0)`);
  }

  if (params.minDuration !== null && params.minDuration !== undefined) {
    whereClauses.push(`t.duration_sec >= @minDuration`);
    bindParams.minDuration = params.minDuration;
  }

  if (params.maxDuration !== null && params.maxDuration !== undefined) {
    whereClauses.push(`t.duration_sec <= @maxDuration`);
    bindParams.maxDuration = params.maxDuration;
  }

  if (params.multiOnly) {
    havingClauses.push(`COUNT(DISTINCT ta.emission_id) > 1 OR COUNT(ta.id) > 1`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const havingSql = havingClauses.length > 0 ? `HAVING ${havingClauses.join(' AND ')}` : '';

  let orderBySql = `ORDER BY COALESCE(MAX(ta.broadcast_date), '') DESC, MAX(e.number) DESC, t.author ASC, t.title ASC`;
  switch (params.sort) {
    case 'oldest':
      orderBySql = `ORDER BY COALESCE(MIN(ta.broadcast_date), '9999-99-99') ASC, MIN(e.number) ASC, t.author ASC`;
      break;
    case 'title':
      orderBySql = `ORDER BY t.title COLLATE NOCASE ASC, t.author COLLATE NOCASE ASC`;
      break;
    case 'author':
      orderBySql = `ORDER BY t.author COLLATE NOCASE ASC, t.title COLLATE NOCASE ASC`;
      break;
    case 'duration_desc':
      orderBySql = `ORDER BY (t.duration_sec IS NULL) ASC, t.duration_sec DESC, t.author ASC`;
      break;
    case 'duration_asc':
      orderBySql = `ORDER BY (t.duration_sec IS NULL) ASC, t.duration_sec ASC, t.author ASC`;
      break;
    case 'appearances_desc':
      orderBySql = `ORDER BY COUNT(DISTINCT ta.emission_id) DESC, COUNT(ta.id) DESC, COALESCE(MAX(ta.broadcast_date), '') DESC`;
      break;
    default:
      break;
  }

  const baseGroupedQuery = `
    SELECT
      t.id,
      t.title,
      t.author,
      t.label,
      t.country,
      t.duration_sec,
      t.duration_source,
      t.preview_url,
      COUNT(DISTINCT ta.emission_id) AS appearance_count,
      MIN(ta.broadcast_date) AS first_broadcast_date,
      MAX(ta.broadcast_date) AS last_broadcast_date
    FROM tracks t
    ${joinFts}
    INNER JOIN track_appearances ta ON ta.track_id = t.id
    INNER JOIN emissions e ON e.id = ta.emission_id
    ${whereSql}
    GROUP BY t.id
    ${havingSql}
  `;

  const countRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM (${baseGroupedQuery})`)
    .get(bindParams) as { cnt: number };
  const total = countRow.cnt;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const rows = db
    .prepare(`${baseGroupedQuery} ${orderBySql} LIMIT @limit OFFSET @offset`)
    .all({ ...bindParams, limit, offset }) as Array<{
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
  }>;

  if (rows.length === 0) {
    return { items: [], total, page, limit, totalPages };
  }

  const trackIds = rows.map((r) => r.id);
  const placeholders = trackIds.map(() => '?').join(',');
  const appearanceRows = db
    .prepare(
      `
      SELECT
        ta.track_id,
        ta.emission_id,
        e.number AS emission_number,
        e.slug AS emission_slug,
        e.title AS emission_title,
        e.url AS emission_url,
        ta.broadcast_date,
        ta.broadcast_date_label,
        ta.position,
        ta.version,
        ta.label,
        ta.country
      FROM track_appearances ta
      INNER JOIN emissions e ON e.id = ta.emission_id
      WHERE ta.track_id IN (${placeholders})
      ORDER BY COALESCE(ta.broadcast_date, '') DESC, e.number DESC, ta.version ASC, ta.position ASC
    `
    )
    .all(...trackIds) as Array<TrackAppearanceInfo & { track_id: number }>;

  const appByTrack = new Map<number, TrackAppearanceInfo[]>();
  for (const app of appearanceRows) {
    const list = appByTrack.get(app.track_id) ?? [];
    list.push({
      emission_id: app.emission_id,
      emission_number: app.emission_number,
      emission_slug: app.emission_slug,
      emission_title: app.emission_title,
      emission_url: app.emission_url,
      broadcast_date: app.broadcast_date,
      broadcast_date_label: app.broadcast_date_label,
      position: app.position,
      version: app.version,
      label: app.label,
      country: app.country,
    });
    appByTrack.set(app.track_id, list);
  }

  const items: TrackSearchItem[] = rows.map((row) => ({
    ...row,
    appearances: appByTrack.get(row.id) ?? [],
  }));

  return { items, total, page, limit, totalPages };
}

export function listEmissions(params: {
  q?: string;
  year?: number | null;
  page?: number;
  limit?: number;
}): {
  items: EmissionRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 24));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const bind: Record<string, string | number> = {};

  if (params.year) {
    whereClauses.push(`year = @year`);
    bind.year = params.year;
  }

  if (params.q && params.q.trim()) {
    whereClauses.push(
      `(title LIKE @q OR COALESCE(subtitle, '') LIKE @q OR COALESCE(description, '') LIKE @q OR COALESCE(broadcast_date_label, '') LIKE @q OR CAST(number AS TEXT) = @qExact)`
    );
    bind.q = `%${params.q.trim()}%`;
    bind.qExact = params.q.trim();
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM emissions ${whereSql}`)
    .get(bind) as { cnt: number };

  const items = db
    .prepare(
      `SELECT * FROM emissions ${whereSql} ORDER BY COALESCE(number, 0) DESC, COALESCE(broadcast_date, '') DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...bind, limit, offset }) as EmissionRecord[];

  return {
    items,
    total: totalRow.cnt,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(totalRow.cnt / limit)),
  };
}

export function getEmissionDetail(slugOrNum: string): {
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
} | null {
  const isNum = /^\d+$/.test(slugOrNum);
  const emission = (
    isNum
      ? db.prepare(`SELECT * FROM emissions WHERE number = ?`).get(Number(slugOrNum))
      : db.prepare(`SELECT * FROM emissions WHERE slug = ?`).get(slugOrNum)
  ) as EmissionRecord | undefined;

  if (!emission) return null;

  const rows = db
    .prepare(
      `
      SELECT
        t.id AS track_id,
        ta.position,
        ta.version,
        t.title,
        t.author,
        COALESCE(ta.label, t.label) AS label,
        COALESCE(ta.country, t.country) AS country,
        t.duration_sec,
        t.duration_source,
        t.preview_url
      FROM track_appearances ta
      INNER JOIN tracks t ON t.id = ta.track_id
      WHERE ta.emission_id = ?
      ORDER BY ta.version ASC, ta.position ASC
    `
    )
    .all(emission.id) as Array<{
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
  }>;

  const trackIds = Array.from(new Set(rows.map((r) => r.track_id)));
  const othersMap = new Map<
    number,
    Array<{ emission_number: number | null; emission_slug: string; broadcast_date_label: string | null }>
  >();

  if (trackIds.length > 0) {
    const placeholders = trackIds.map(() => '?').join(',');
    const otherRows = db
      .prepare(
        `
        SELECT DISTINCT
          ta.track_id,
          e.number AS emission_number,
          e.slug AS emission_slug,
          ta.broadcast_date_label
        FROM track_appearances ta
        INNER JOIN emissions e ON e.id = ta.emission_id
        WHERE ta.track_id IN (${placeholders}) AND ta.emission_id != ?
        ORDER BY e.number DESC
      `
      )
      .all(...trackIds, emission.id) as Array<{
      track_id: number;
      emission_number: number | null;
      emission_slug: string;
      broadcast_date_label: string | null;
    }>;

    for (const o of otherRows) {
      const list = othersMap.get(o.track_id) ?? [];
      list.push({
        emission_number: o.emission_number,
        emission_slug: o.emission_slug,
        broadcast_date_label: o.broadcast_date_label,
      });
      othersMap.set(o.track_id, list);
    }
  }

  return {
    emission,
    tracks: rows.map((r) => ({
      ...r,
      other_emissions: othersMap.get(r.track_id) ?? [],
    })),
  };
}

export function getStats() {
  const counts = db
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM emissions) AS emissions_count,
        (SELECT COUNT(*) FROM tracks) AS tracks_count,
        (SELECT COUNT(*) FROM track_appearances) AS appearances_count,
        (SELECT COUNT(*) FROM tracks WHERE duration_sec IS NOT NULL AND duration_sec > 0) AS tracks_with_duration,
        (SELECT COUNT(*) FROM (SELECT track_id FROM track_appearances GROUP BY track_id HAVING COUNT(DISTINCT emission_id) > 1)) AS multi_emission_tracks,
        (SELECT MIN(broadcast_date) FROM emissions WHERE broadcast_date IS NOT NULL) AS min_date,
        (SELECT MAX(broadcast_date) FROM emissions WHERE broadcast_date IS NOT NULL) AS max_date,
        (SELECT SUM(duration_sec) FROM tracks WHERE duration_sec IS NOT NULL) AS total_known_duration_sec
    `
    )
    .get() as {
    emissions_count: number;
    tracks_count: number;
    appearances_count: number;
    tracks_with_duration: number;
    multi_emission_tracks: number;
    min_date: string | null;
    max_date: string | null;
    total_known_duration_sec: number | null;
  };

  const years = db
    .prepare(
      `SELECT year, COUNT(*) AS count FROM emissions WHERE year IS NOT NULL GROUP BY year ORDER BY year DESC`
    )
    .all() as Array<{ year: number; count: number }>;

  const topCountries = db
    .prepare(
      `SELECT country, COUNT(*) AS count FROM tracks WHERE country IS NOT NULL AND TRIM(country) != '' GROUP BY country ORDER BY count DESC LIMIT 18`
    )
    .all() as Array<{ country: string; count: number }>;

  const topAuthors = db
    .prepare(
      `
      SELECT t.author, COUNT(DISTINCT ta.emission_id) AS emission_count, COUNT(ta.id) AS play_count
      FROM tracks t
      INNER JOIN track_appearances ta ON ta.track_id = t.id
      GROUP BY LOWER(t.author)
      ORDER BY play_count DESC, emission_count DESC
      LIMIT 15
    `
    )
    .all() as Array<{ author: string; emission_count: number; play_count: number }>;

  return {
    ...counts,
    years,
    topCountries,
    topAuthors,
  };
}

export function getAuthorsRanking(params: { offset?: number; limit?: number; q?: string }) {
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const q = params.q?.trim();
  const whereSql = q ? `WHERE LOWER(t.author) LIKE @qPattern` : '';
  const bind: Record<string, string | number> = q
    ? { qPattern: `%${q.toLowerCase()}%`, limit, offset }
    : { limit, offset };

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM (SELECT 1 FROM tracks t ${whereSql} GROUP BY LOWER(t.author))`
    )
    .get(bind) as { cnt: number };

  const items = db
    .prepare(
      `
      SELECT
        t.author,
        COUNT(DISTINCT t.id) AS unique_tracks,
        COUNT(DISTINCT ta.emission_id) AS emission_count,
        COUNT(ta.id) AS play_count
      FROM tracks t
      INNER JOIN track_appearances ta ON ta.track_id = t.id
      ${whereSql}
      GROUP BY LOWER(t.author)
      ORDER BY play_count DESC, emission_count DESC, t.author COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(bind) as Array<{
    author: string;
    unique_tracks: number;
    emission_count: number;
    play_count: number;
  }>;

  return {
    items,
    total: totalRow.cnt,
    offset,
    limit,
    hasMore: offset + items.length < totalRow.cnt,
  };
}

export function getCountriesRanking(params: { offset?: number; limit?: number; q?: string }) {
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const q = params.q?.trim();
  const whereSql = q
    ? `WHERE country IS NOT NULL AND TRIM(country) != '' AND LOWER(country) LIKE @qPattern`
    : `WHERE country IS NOT NULL AND TRIM(country) != ''`;
  const bind: Record<string, string | number> = q
    ? { qPattern: `%${q.toLowerCase()}%`, limit, offset }
    : { limit, offset };

  const totalRow = db
    .prepare(`SELECT COUNT(DISTINCT country) AS cnt FROM tracks ${whereSql}`)
    .get(bind) as { cnt: number };

  const items = db
    .prepare(
      `
      SELECT
        country,
        COUNT(*) AS count
      FROM tracks
      ${whereSql}
      GROUP BY country
      ORDER BY count DESC, country COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(bind) as Array<{ country: string; count: number }>;

  return {
    items,
    total: totalRow.cnt,
    offset,
    limit,
    hasMore: offset + items.length < totalRow.cnt,
  };
}

export function getTopTracksRanking(params: { offset?: number; limit?: number }) {
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));

  const totalRow = db
    .prepare(
      `
      SELECT COUNT(*) AS cnt FROM (
        SELECT ta.track_id
        FROM track_appearances ta
        GROUP BY ta.track_id
        HAVING COUNT(DISTINCT ta.emission_id) > 1
      )
    `
    )
    .get() as { cnt: number };

  const items = db
    .prepare(
      `
      SELECT
        t.id,
        t.title,
        t.author,
        t.duration_sec,
        t.country,
        COUNT(DISTINCT ta.emission_id) AS emission_count,
        COUNT(ta.id) AS play_count,
        MIN(ta.broadcast_date) AS first_date,
        MAX(ta.broadcast_date) AS last_date
      FROM tracks t
      INNER JOIN track_appearances ta ON ta.track_id = t.id
      GROUP BY t.id
      HAVING COUNT(DISTINCT ta.emission_id) > 1
      ORDER BY emission_count DESC, play_count DESC, MAX(COALESCE(ta.broadcast_date, '')) DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all({ limit, offset }) as Array<{
    id: number;
    title: string;
    author: string;
    duration_sec: number | null;
    country: string | null;
    emission_count: number;
    play_count: number;
    first_date: string | null;
    last_date: string | null;
  }>;

  return {
    items,
    total: totalRow.cnt,
    offset,
    limit,
    hasMore: offset + items.length < totalRow.cnt,
  };
}

export function getYearsRanking(params: { offset?: number; limit?: number }) {
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(100, Math.max(1, params.limit ?? 15));

  const totalRow = db
    .prepare(`SELECT COUNT(DISTINCT year) AS cnt FROM emissions WHERE year IS NOT NULL`)
    .get() as { cnt: number };

  const maxRow = db
    .prepare(
      `SELECT MAX(c) AS maxCount FROM (SELECT COUNT(*) AS c FROM emissions WHERE year IS NOT NULL GROUP BY year)`
    )
    .get() as { maxCount: number | null };

  const items = db
    .prepare(
      `
      SELECT
        e.year,
        COUNT(DISTINCT e.id) AS count,
        COUNT(ta.id) AS track_plays
      FROM emissions e
      LEFT JOIN track_appearances ta ON ta.emission_id = e.id
      WHERE e.year IS NOT NULL
      GROUP BY e.year
      ORDER BY e.year DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all({ limit, offset }) as Array<{ year: number; count: number; track_plays: number }>;

  return {
    items,
    total: totalRow.cnt,
    maxCount: maxRow.maxCount ?? 1,
    offset,
    limit,
    hasMore: offset + items.length < totalRow.cnt,
  };
}

export function updateTrackDuration(
  trackId: number,
  durationSec: number | null,
  source: string,
  previewUrl?: string | null
) {
  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE tracks
    SET duration_sec = ?, duration_source = ?, preview_url = COALESCE(?, preview_url), updated_at = ?
    WHERE id = ?
  `
  ).run(durationSec, source, previewUrl ?? null, now, trackId);
}

export function updateTrackPreviewUrl(trackId: number, previewUrl: string) {
  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE tracks
    SET preview_url = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(previewUrl, now, trackId);
}

export function getExistingEmissionSlugs(): Set<string> {
  const rows = db.prepare(`SELECT slug FROM emissions`).all() as Array<{ slug: string }>;
  return new Set(rows.map((r) => r.slug));
}
