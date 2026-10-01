const db = require('./db.js');
const prisma = db.default || db.prisma || db;

/**
 * L2 Database Cache Helpers backed by Postgres / Prisma
 * All operations are safely wrapped in try/catch for graceful degradation.
 */

async function getVideoCache(vkey) {
  if (!vkey) return null;
  try {
    const row = await prisma.videoCache.findUnique({
      where: { vkey },
    });
    if (!row) return null;
    if (new Date(row.expiresAt) <= new Date()) {
      return null;
    }
    return row.data;
  } catch (err) {
    console.warn(`[L2 Cache] getVideoCache("${vkey}") failed:`, err.message);
    return null;
  }
}

async function setVideoCache(vkey, data, ttlSeconds = 600) {
  if (!vkey || !data) return;
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await prisma.videoCache.upsert({
      where: { vkey },
      create: {
        vkey,
        title: data.title || 'Untitled',
        thumbnail: data.thumbnail || null,
        duration: data.duration || null,
        durationSec: typeof data.durationSec === 'number' ? data.durationSec : null,
        views: data.views ? String(data.views) : null,
        viewsNum: typeof data.viewsNum === 'number' ? data.viewsNum : null,
        data,
        expiresAt,
      },
      update: {
        title: data.title || 'Untitled',
        thumbnail: data.thumbnail || null,
        duration: data.duration || null,
        durationSec: typeof data.durationSec === 'number' ? data.durationSec : null,
        views: data.views ? String(data.views) : null,
        viewsNum: typeof data.viewsNum === 'number' ? data.viewsNum : null,
        data,
        cachedAt: new Date(),
        expiresAt,
      },
    });
  } catch (err) {
    console.warn(`[L2 Cache] setVideoCache("${vkey}") failed:`, err.message);
  }
}

async function getFeedCache(key) {
  if (!key) return null;
  try {
    const row = await prisma.feedCache.findUnique({
      where: { key },
    });
    if (!row) return null;
    if (new Date(row.expiresAt) <= new Date()) {
      return null;
    }
    return row.data;
  } catch (err) {
    console.warn(`[L2 Cache] getFeedCache("${key}") failed:`, err.message);
    return null;
  }
}

async function setFeedCache(key, data, ttlSeconds = 300) {
  if (!key || !data) return;
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await prisma.feedCache.upsert({
      where: { key },
      create: {
        key,
        data,
        expiresAt,
      },
      update: {
        data,
        cachedAt: new Date(),
        expiresAt,
      },
    });
  } catch (err) {
    console.warn(`[L2 Cache] setFeedCache("${key}") failed:`, err.message);
  }
}

module.exports = {
  getVideoCache,
  setVideoCache,
  getFeedCache,
  setFeedCache,
};
