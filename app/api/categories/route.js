import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';

const proxied = (v) => v || null; // Direct URL - VideoCard tries direct first, falls back to /api/img on error

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
