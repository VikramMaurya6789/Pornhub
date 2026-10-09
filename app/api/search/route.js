import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';
import prisma from '../../../lib/db.js';
import { parseDurationSec } from '../../../lib/format.js';

const proxied = (v) => (v ? `/api/img?u=${encodeURIComponent(v)}&v=3` : null);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const sort = searchParams.get('sort') || 'relevant';
    const durationFilter = searchParams.get('duration') || 'all';
    const hdOnly = searchParams.get('hd') === '1';
    const perPage = 24;

    // Search logging (fast upsert, never fail)
    if (q.length >= 2) {
      const normQ = q.toLowerCase().slice(0, 100);
      try {
        await prisma.searchLog
          .upsert({
            where: { query: normQ },
            create: { query: normQ, count: 1 },
            update: { count: { increment: 1 } },
          })
          .catch(() => {});
      } catch {}
    }

    // Primary: search the database cache by title
    // This is fast, reliable, and actually filters by the query
    let videos = [];
    let total = 0;
    try {
      const qLower = q.toLowerCase();
      const words = qLower.split(/\s+/).filter((w) => w.length > 1);

      if (words.length > 0) {
        // Build a WHERE clause that matches any word in the title
        let conditions = words.map((w) => `LOWER("title") LIKE '%${w.replace(/'/g, "''")}%'`).join(' OR ');
        conditions = `(${conditions})`;

        // Duration filter
        if (durationFilter === 'short') conditions += ` AND "durationSec" < 600`;
        else if (durationFilter === 'medium') conditions += ` AND "durationSec" >= 600 AND "durationSec" <= 1800`;
        else if (durationFilter === 'long') conditions += ` AND "durationSec" > 1800`;

        // HD filter (videos with HD badge in data)
        if (hdOnly) conditions += ` AND ("data"::text LIKE '%"hd":true%' OR "data"::text LIKE '%HD%')`;

        const countResult = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM "VideoCache" WHERE ${conditions}`
        );
        total = parseInt(countResult[0]?.count || '0', 10);

        if (total > 0) {
          // Sort options
          let orderBy = '"cachedAt" DESC';
          if (sort === 'viewed') orderBy = '"viewsNum" DESC NULLS LAST';
          else if (sort === 'rated') orderBy = '"viewsNum" DESC NULLS LAST';
          else if (sort === 'longest') orderBy = '"durationSec" DESC NULLS LAST';

          const offset = (page - 1) * perPage;
          const rows = await prisma.$queryRawUnsafe(
            `SELECT "vkey", "title", "thumbnail", "duration", "durationSec", "views", "viewsNum", "data" ` +
            `FROM "VideoCache" WHERE ${conditions} ORDER BY ${orderBy} LIMIT ${perPage} OFFSET ${offset}`
          );

          videos = rows.map((r) => {
            let data = {};
            try { data = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {}); } catch {}
            return {
              vkey: r.vkey,
              title: r.title,
              thumbnail: proxied(r.thumbnail || data.thumbnail),
              duration: r.duration,
              durationSec: r.durationSec,
              views: r.views,
              viewsNum: r.viewsNum,
              preview: data.preview,
              url: `/watch/${r.vkey}`,
            };
          });
        }
      }
    } catch (e) {
      console.error('[search] DB search failed:', e.message);
    }

    // Fallback: try upstream scraper if DB has no results
    if (videos.length === 0) {
      try {
        await scraper.warmup();
        const data = await scraper.searchVideos(q, page, sort);
        const scraped = (data.videos || []).filter((v) => parseDurationSec(v.duration) >= 60);
        // Only use scraped results if they actually match the query (relevance check)
        const qWords = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        const relevant = qWords.length === 0 ? scraped : scraped.filter((v) => {
          const t = (v.title || '').toLowerCase();
          return qWords.some((w) => t.includes(w));
        });
        if (relevant.length > 0) {
          videos = relevant.slice(0, perPage).map((v) => ({
            ...v,
            thumbnail: proxied(v.thumbnail),
            preview: v.preview && /^https?:\/\//i.test(v.preview) ? `/api/seg?u=${encodeURIComponent(v.preview)}` : v.preview,
          }));
          total = relevant.length;
        }
      } catch {}
    }

    return NextResponse.json(
      {
        videos,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        query: q,
        sort,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message || 'search failed' }, { status: 502 });
  }
}
