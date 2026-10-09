import { NextResponse } from 'next/server';

// Force dynamic - NEVER cache or static-optimize this proxy.
// Each ?u= URL must fetch its own upstream image.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Rotating browser UAs to avoid bot-detection placeholder images from phncdn.com
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
];
const pickUA = (u) => {
  let h = 0;
  for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0;
  return UAS[h % UAS.length];
};

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
          'User-Agent': pickUA(u),
          'Referer': 'https://www.pornhub.com/',
          'Accept': 'image/webp,image/jpeg,image/png,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site',
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

      // Reject known bot-detection placeholder images from phncdn.com.
      // These are stock photos served instead of real thumbnails to datacenter IPs.
      // Returning 502 lets the VideoCard show its proper fallback instead of a wrong image.
      const PLACEHOLDER_SIZES = new Set([12650]); // Known placeholder byte sizes
      if (PLACEHOLDER_SIZES.has(buf.byteLength)) {
        return NextResponse.json(
          { error: 'Upstream returned placeholder image' },
          { status: 502, headers: NO_CACHE_HEADERS }
        );
      }

      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': ct,
          // Permanent fix for "same thumbnail" bug (2026-10-10):
          // NEVER use s-maxage/immutable here. Netlify's edge cache was
          // collapsing different ?u= URLs to the same cached image.
          // Browser-only caching (max-age) is safe; CDN must revalidate.
          'Cache-Control': 'public, max-age=86400, s-maxage=0, must-revalidate',
          'Access-Control-Allow-Origin': '*',
          // Unique ETag per upstream URL prevents any cache collisions
          'ETag': `"img-${Buffer.from(u).toString('base64').slice(0, 32).replace(/[^A-Za-z0-9]/g, '')}"`,
          'Vary': 'Accept',
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

