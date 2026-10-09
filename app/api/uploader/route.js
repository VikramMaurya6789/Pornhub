import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';

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

const proxied = (v) => (v ? `/api/img?u=${encodeURIComponent(v)}&v=3` : null);

export async function GET(req) {
  try {
    await scraper.warmup();
    const { searchParams } = new URL(req.url);
    const uploaderUrl = (searchParams.get('url') || '').trim();
    if (!uploaderUrl) {
      return NextResponse.json({ error: 'missing url' }, { status: 400, headers: CORS_HEADERS });
    }
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

    const data = await scraper.uploaderVideos(uploaderUrl, page);

    const safeVideos = (data.videos || []).map((v) => ({
      ...v,
      thumbnail: proxied(v.thumbnail) || '/og-image.jpg',
      preview: v.preview && /^https?:\/\//i.test(v.preview) ? `/api/seg?u=${encodeURIComponent(v.preview)}` : v.preview,
    }));

    return NextResponse.json(
      {
        url: data.url,
        name: data.name,
        avatar: data.avatar && /phncdn\.com/i.test(data.avatar) ? proxied(data.avatar) : data.avatar,
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
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'uploader lookup failed' },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
