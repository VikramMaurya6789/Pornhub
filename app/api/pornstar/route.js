import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';
import prisma from '../../../lib/db.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Origin, User-Agent',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
  });
}

const proxied = (v) => v || null; // Direct URL - VideoCard tries direct first, falls back to /api/img on error

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get('name') || searchParams.get('slug') || '').trim();
    if (!raw) {
      return NextResponse.json({ error: 'missing name or slug' }, { status: 400, headers: CORS_HEADERS });
    }
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const slug = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
    const name = slug.replace(/[-_]/g, ' ');
    const displayName = raw.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const perPage = 24;

    // Primary: search DB cache for videos with the pornstar's name in the title
    let videos = [];
    let totalPages = 1;
    try {
      const nameWords = name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      if (nameWords.length > 0) {
        const conditions = nameWords.map((w) => `LOWER("title") LIKE '%${w.replace(/'/g, "''")}%'`).join(' AND ');
        const countResult = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM "VideoCache" WHERE ${conditions}`
        ).catch(() => [{ count: '0' }]);
        const total = parseInt(countResult[0]?.count || '0', 10);

        if (total > 0) {
          totalPages = Math.ceil(total / perPage);
          const offset = (page - 1) * perPage;
          const rows = await prisma.$queryRawUnsafe(
            `SELECT "vkey", "title", "thumbnail", "duration", "durationSec", "views", "viewsNum", "data" ` +
            `FROM "VideoCache" WHERE ${conditions} ORDER BY "viewsNum" DESC NULLS LAST LIMIT ${perPage} OFFSET ${offset}`
          ).catch(() => []);

          videos = rows.map((r) => {
            let data = {};
            try { data = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {}); } catch {}
            return {
              vkey: r.vkey,
              title: r.title,
              thumbnail: proxied(r.thumbnail || data.thumbnail) || '/og-image.jpg',
              duration: r.duration,
              durationSec: r.durationSec,
              views: r.views,
              viewsNum: r.viewsNum,
              preview: data.preview && /^https?:\/\//i.test(data.preview) ? `/api/seg?u=${encodeURIComponent(data.preview)}` : data.preview,
              url: `/watch/${r.vkey}`,
            };
          });
        }
      }
    } catch (e) {
      console.error('[pornstar] DB search failed:', e.message);
    }

    // Fallback: try upstream scraper if DB has no results
    if (videos.length === 0) {
      try {
        await scraper.warmup();
        const data = await scraper.pornstarVideos(slug, page);
        // Validate: only use if the returned name matches the requested slug
        const returnedName = (data.name || '').toLowerCase();
        const firstWord = name.toLowerCase().split(' ')[0];
        if (data && data.videos && data.videos.length > 0 && returnedName.includes(firstWord)) {
          const safeVideos = data.videos.map((v) => ({
            ...v,
            thumbnail: proxied(v.thumbnail) || '/og-image.jpg',
            preview: v.preview && /^https?:\/\//i.test(v.preview) ? `/api/seg?u=${encodeURIComponent(v.preview)}` : v.preview,
          }));
          return NextResponse.json(
            {
              name: data.name || displayName,
              slug: data.slug || slug,
              avatar: data.avatar && /phncdn\.com/i.test(data.avatar)
                ? proxied(data.avatar)
                : (data.avatar || `/api/avatar?name=${encodeURIComponent(displayName)}`),
              videos: safeVideos,
              page: data.page || page,
              totalPages: data.totalPages || 1,
            },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                ...CORS_HEADERS,
              },
            }
          );
        }
      } catch {}
    }

    return NextResponse.json(
      {
        name: displayName,
        slug,
        avatar: `/api/avatar?name=${encodeURIComponent(displayName)}`,
        videos,
        page,
        totalPages,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          ...CORS_HEADERS,
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'pornstar lookup failed' },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
