import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';

const proxied = (v) => v ? `/api/img?u=${encodeURIComponent(v)}&v=3` : null;

export async function GET() {
  try {
    await scraper.warmup();
    const cats = await scraper.categories();
    return NextResponse.json(
      cats.map(c => ({ ...c, thumbnail: proxied(c.thumbnail) })),
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600',
          'CDN-Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600',
        },
      }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message || 'categories failed' }, { status: 502 });
  }
}
