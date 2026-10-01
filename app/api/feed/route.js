import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';
import prisma from '../../../lib/db.js';
import { parseViewsNumber, formatMaxViews, parseDurationSec } from '../../../lib/format.js';

const proxied = (v) => (v ? `/api/img?u=${encodeURIComponent(v)}` : null);

function shapeCard(v) {
  return {
    ...v,
    thumbnail: proxied(v.thumbnail),
    preview: v.preview && /^https?:\/\//i.test(v.preview) ? `/api/seg?u=${encodeURIComponent(v.preview)}` : v.preview,
  };
}

export async function GET(req) {
  try {
    await scraper.warmup();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'home';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const mix = searchParams.get('mix') || '0';
    const data = await scraper.feed(type, page, mix);

    let videos = (Array.isArray(data?.videos) ? data.videos : [])
      .filter((v) => parseDurationSec(v.duration) >= 600);

    // Rank / adjust by internal views from DB where available
    if (videos.length > 0 && prisma && prisma.videoStat) {
      try {
        const vkeys = videos.map((v) => v.vkey).filter(Boolean);
        if (vkeys.length > 0) {
          const stats = await prisma.videoStat.findMany({
            where: { vkey: { in: vkeys } },
          });
          const statMap = new Map();
          for (const s of stats) {
            statMap.set(s.vkey, s.views);
          }

          videos = videos.map((v) => {
            const internalViews = statMap.get(v.vkey) || 0;
            const upstreamNum = parseViewsNumber(v.views);
            const maxViewsNum = Math.max(upstreamNum, internalViews);
            return {
              ...v,
              _sortViews: maxViewsNum,
              views: internalViews > 0 ? formatMaxViews(v.views, internalViews) : v.views,
            };
          });

          if (type === 'most_viewed' || type === 'hottest') {
            videos.sort((a, b) => (b._sortViews || 0) - (a._sortViews || 0));
          }
        }
      } catch (err) {
        console.warn('[feed route] Internal view sort fallback:', err.message);
      }
    }

    return NextResponse.json(
      { ...data, videos: videos.map(shapeCard) },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message || 'feed failed' }, { status: 502 });
  }
}
