import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';
import prisma from '../../../lib/db.js';
import { parseDurationSec } from '../../../lib/format.js';

const proxied = (v) => (v ? `/api/img?u=${encodeURIComponent(v)}` : null);

export async function GET(req) {
  try {
    await scraper.warmup();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const sort = searchParams.get('sort') || 'relevant';

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

    const data = await scraper.searchVideos(q, page, sort);
    return NextResponse.json(
      {
        ...data,
        videos: (data.videos || [])
          .filter((v) => parseDurationSec(v.duration) >= 600)
          .map((v) => ({
            ...v,
            thumbnail: proxied(v.thumbnail),
            preview: v.preview && /^https?:\/\//i.test(v.preview) ? `/api/seg?u=${encodeURIComponent(v.preview)}` : v.preview,
          })),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message || 'search failed' }, { status: 502 });
  }
}
