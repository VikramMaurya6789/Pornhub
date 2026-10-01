import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';
import { curlText } from '../../../lib/cdn.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Origin, User-Agent',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Proxies an HLS master playlist so all segment/variant requests stay on the
// server. Automatically refreshes stream tokens if expired.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    let u = searchParams.get('u');
    const vkey = searchParams.get('vkey');

    // If u is missing but vkey is present, dynamically fetch video streams
    if ((!u || !/^https?:\/\//.test(u)) && vkey) {
      try {
        const info = await scraper.videoInfo(vkey, false);
        if (info && info.streams && info.streams.length > 0) {
          const rawUrl = info.streams[0].url;
          u = rawUrl.startsWith('/api/hls')
            ? (new URL(rawUrl, req.url).searchParams.get('u') || rawUrl)
            : rawUrl;
        }
      } catch {}
    }

    if (!u || !/^https?:\/\//.test(u)) {
      return NextResponse.json({ error: 'bad url' }, { status: 400, headers: CORS_HEADERS });
    }

    let status = 0;
    let text = '';
    let curlErr = '';
    try {
      const res = await curlText(u, 12);
      status = res.status;
      text = res.text;
    } catch (e) {
      curlErr = e.message;
      console.warn('[hls route] curlText error:', e.message);
    }

    // If upstream token expired or 403/410, attempt instant refresh if vkey is available
    if ((status !== 200 || !text || text.includes('expired token')) && vkey) {
      console.log('[hls route] Stream expired for ' + vkey + ', refreshing stream info...');
      try {
        const freshInfo = await scraper.videoInfo(vkey, true);
        if (freshInfo && freshInfo.streams && freshInfo.streams.length > 0) {
          const freshMaster = freshInfo.streams[0].url;
          if (freshMaster && freshMaster !== u) {
            u = freshMaster.startsWith('/api/hls') ? (new URL(freshMaster, req.url).searchParams.get('u') || freshMaster) : freshMaster;
            const retryRes = await curlText(u, 12);
            status = retryRes.status;
            text = retryRes.text;
          }
        }
      } catch (err) {
        console.warn('[hls route] Stream refresh failed:', err.message);
      }
    }

    if (status !== 200 || !text || text.includes('expired token')) {
      return NextResponse.json({
        error: 'Upstream stream unavailable or expired',
        upstreamStatus: status,
        curlErr,
        snippet: (text || '').slice(0, 100),
      }, { status: 502, headers: CORS_HEADERS });
    }

    const out = scraper.rewritePlaylist(u, text, (abs) => `/api/seg?v=3&vkey=${encodeURIComponent(vkey || '')}&u=${encodeURIComponent(abs)}`);
    return new NextResponse(out, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        ...CORS_HEADERS,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'HLS proxy failed' }, { status: 502, headers: CORS_HEADERS });
  }
}

