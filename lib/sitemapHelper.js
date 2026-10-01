import fs from 'fs';
import path from 'path';
import { SEED_VIDEOS } from './seedData.js';

let cachedVideos = null;

function parseDurationSeconds(d) {
  if (!d) return 600;
  if (typeof d === 'number') return Math.max(1, Math.min(28800, Math.round(d)));
  const s = String(d).trim();
  const parts = s.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 600;
  if (parts.length === 3) return Math.max(1, Math.min(28800, parts[0] * 3600 + parts[1] * 60 + parts[2]));
  if (parts.length === 2) return Math.max(1, Math.min(28800, parts[0] * 60 + parts[1]));
  return 600;
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getAllVideos() {
  if (cachedVideos && cachedVideos.length > 0) {
    return cachedVideos;
  }

  const list = [];
  const seen = new Set();

  // Add SEED_VIDEOS first
  if (Array.isArray(SEED_VIDEOS)) {
    for (const v of SEED_VIDEOS) {
      if (v?.vkey && !seen.has(v.vkey)) {
        seen.add(v.vkey);
        list.push(v);
      }
    }
  }

  // Add auto_videos.json
  try {
    const autoPath = path.join(process.cwd(), 'auto_videos.json');
    if (fs.existsSync(autoPath)) {
      const autoData = JSON.parse(fs.readFileSync(autoPath, 'utf8'));
      if (Array.isArray(autoData)) {
        for (const v of autoData) {
          if (v?.vkey && !seen.has(v.vkey)) {
            seen.add(v.vkey);
            list.push(v);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[sitemapHelper] Failed to load auto_videos.json:', err.message);
  }

  cachedVideos = list.filter((v) => parseDurationSeconds(v.duration || v.durationSec) >= 600);
  return cachedVideos;
}

export function generateVideoSitemapXml(page = 1, pageSize = 1000) {
  const all = getAllVideos();
  const start = Math.max(0, (page - 1) * pageSize);
  const slice = all.slice(start, start + pageSize);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://orangehub.royalcloud.qzz.io';
  const defaultPubDate = '2026-01-01T00:00:00+00:00';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

  for (const v of slice) {
    const vkey = v.vkey;
    const loc = `${baseUrl}/watch/${encodeURIComponent(vkey)}`;
    const title = escapeXml(v.title || `Video ${vkey}`);
    const desc = escapeXml(`Watch ${v.title || 'video'} in 1080p Full HD on OrangeHub.`);
    const rawThumb = v.thumbnail || `${baseUrl}/og-banner.png`;
    const thumb = rawThumb.startsWith('http')
      ? `${baseUrl}/api/img?u=${encodeURIComponent(rawThumb)}`
      : (rawThumb.startsWith('/') ? `${baseUrl}${rawThumb}` : `${baseUrl}/${rawThumb}`);
    const duration = parseDurationSeconds(v.duration || v.durationSec);

    xml += `  <url>\n`;
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <video:video>\n`;
    xml += `      <video:thumbnail_loc>${escapeXml(thumb)}</video:thumbnail_loc>\n`;
    xml += `      <video:title>${title}</video:title>\n`;
    xml += `      <video:description>${desc}</video:description>\n`;
    xml += `      <video:duration>${duration}</video:duration>\n`;
    xml += `      <video:publication_date>${defaultPubDate}</video:publication_date>\n`;
    xml += `    </video:video>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}
