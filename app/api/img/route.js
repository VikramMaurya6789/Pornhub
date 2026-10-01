import { NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*',
};

// Thumbnail / image proxy — strictly verifies upstream status and image content-type.
// Returns 502 JSON for non-2xx or non-image upstreams; never caches error responses.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const u = searchParams.get('u') || searchParams.get('url');
    if (!u || !/^https?:\/\//i.test(u)) {
      return NextResponse.json({ error: 'Invalid or missing image URL' }, { status: 502, headers: NO_CACHE_HEADERS });
    }

    // Directly redirect for public CDNs (Unsplash)
    if (u.includes('unsplash.com')) {
      return NextResponse.redirect(u);
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);

    try {
      const upstream = await fetch(u, {
        headers: {
          'User-Agent': UA,
          'Referer': 'https://www.pornhub.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*',
        },
        redirect: 'follow',
        signal: ctrl.signal,
      });
      clearTimeout(t);

      if (!upstream.ok || upstream.status < 200 || upstream.status >= 300) {
        return NextResponse.json(
          { error: 'Upstream image unavailable', status: upstream.status },
          { status: 502, headers: NO_CACHE_HEADERS }
        );
      }

      const ct = upstream.headers.get('content-type') || '';
      if (!ct.toLowerCase().startsWith('image/')) {
        return NextResponse.json(
          { error: 'Upstream content is not an image', contentType: ct },
          { status: 502, headers: NO_CACHE_HEADERS }
        );
      }

      const buf = await upstream.arrayBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': ct,
          'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      clearTimeout(t);
      return NextResponse.json(
        { error: 'Upstream image fetch failed' },
        { status: 502, headers: NO_CACHE_HEADERS }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Image proxy error' },
      { status: 502, headers: NO_CACHE_HEADERS }
    );
  }
}

