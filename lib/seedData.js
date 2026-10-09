// Video catalog (52k videos) — now backed by D1 (SeedVideo table) on Cloudflare.
// Previously this required ../auto_videos.json (20MB) which blew past the
// Workers 3MB bundle limit. The JSON is imported into D1 once via
// deploy/cloudflare/import-seed.mjs.

import { getD1 } from './d1.js';

function rowToVideo(r) {
  if (!r) return null;
  return {
    vkey: r.vkey,
    title: r.title,
    url: r.url,
    thumbnail: r.thumbnail,
    duration: r.duration,
    views: r.views,
    added: r.added,
    hd: Boolean(r.hd),
    premium: Boolean(r.premium),
    author: r.author,
    preview: r.preview,
  };
}

/** Find one catalog video by vkey. Returns null if not found / no DB. */
export async function getSeedVideoByVkey(vkey) {
  if (!vkey) return null;
  try {
    const db = getD1();
    const row = await db.prepare('SELECT * FROM SeedVideo WHERE vkey = ? LIMIT 1').bind(vkey).first();
    return rowToVideo(row);
  } catch {
    return null;
  }
}

/** Iterate the whole catalog in batches (for sitemaps / scraper fallback). */
export async function* iterSeedVideos(batchSize = 2000) {
  try {
    const db = getD1();
    let offset = 0;
    for (;;) {
      const { results } = await db
        .prepare('SELECT * FROM SeedVideo LIMIT ? OFFSET ?')
        .bind(batchSize, offset)
        .all();
      if (!results || !results.length) break;
      yield results.map(rowToVideo);
      if (results.length < batchSize) break;
      offset += batchSize;
    }
  } catch {
    return;
  }
}

/** Load the entire catalog into memory (52k rows — only for rare batch jobs). */
export async function getAllSeedVideos() {
  const all = [];
  for await (const batch of iterSeedVideos()) {
    all.push(...batch);
  }
  return all;
}

// Back-compat: synchronous SEED_VIDEOS array (empty on Cloudflare; the JSON
// is no longer bundled). Code that needs the catalog should use the async
// helpers above.
export const SEED_VIDEOS = [];
export const getSeedVideos = () => [];
export default { SEED_VIDEOS, getSeedVideos, getSeedVideoByVkey, getAllSeedVideos, iterSeedVideos };
