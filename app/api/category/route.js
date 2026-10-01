import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';
import { parseDurationSec } from '../../../lib/format.js';

const proxied = (v) => v ? `/api/img?u=${encodeURIComponent(v)}` : null;

export async function GET(req) {
  try {
    await scraper.warmup();
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug') || '';
    if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 });
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const data = await scraper.categoryVideos(slug, page);
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
    return NextResponse.json({ error: e.message || 'category failed' }, { status: 502 });
  }
}
