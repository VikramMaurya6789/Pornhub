import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import scraper from '../../../lib/scraper.js';
import { curlText, curlStream } from '../../../lib/cdn.js';

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

// Proxies HLS variant playlists (rewritten) and media segments (streamed
// with Range support) to ensure 100% uninterrupted playback on Indian ISPs.
export async function GET(req) {
  let kill = null;
  try {
    const { searchParams } = new URL(req.url);
    const u = searchParams.get('u');
    const vkey = searchParams.get('vkey');
    if (!u || !/^https?:\/\//.test(u)) {
      return NextResponse.json({ error: 'bad url' }, { status: 400, headers: CORS_HEADERS });
    }

    const range = req.headers.get('range');

    // Variant playlist
    if (/\.m3u8(\?|$)/i.test(u)) {
      let status = 0;
      let text = '';
      try {
        const res = await curlText(u, 12);
        status = res.status;
        text = res.text;
      } catch (err) {
        console.error('[seg route] variant curlText error:', err.message);
      }

      // If variant expired or 403, attempt instant auto-refresh if vkey is available
      if ((status !== 200 || !text || text.includes('expired token')) && vkey) {
        console.log('[seg route] Variant expired for ' + vkey + ', refreshing stream info...');
        try {
          const freshInfo = await scraper.videoInfo(vkey, true);
          if (freshInfo && freshInfo.streams && freshInfo.streams.length > 0) {
            const freshMaster = freshInfo.streams[0].url;
            const freshMasterUrl = freshMaster.startsWith('/api/hls')
              ? (new URL(freshMaster, req.url).searchParams.get('u') || freshMaster)
              : freshMaster;
            const freshMasterRes = await curlText(freshMasterUrl, 12);
            if (freshMasterRes && freshMasterRes.text) {
              const lines = freshMasterRes.text.split('\n');
              const vLine = lines.find((l) => l.trim().length > 0 && !l.startsWith('#'));
              if (vLine) {
                const absVariant = new URL(vLine.trim(), freshMasterUrl).toString();
                const retryVariant = await curlText(absVariant, 12);
                if (retryVariant && retryVariant.status === 200) {
                  status = retryVariant.status;
                  text = retryVariant.text;
                }
              }
            }
          }
        } catch (rErr) {
          console.warn('[seg route] Variant auto-refresh failed:', rErr.message);
        }
      }

      if (status !== 200 || !text || text.includes('expired token')) {
        return NextResponse.json({ error: 'Variant playlist unavailable or expired' }, { status: 502, headers: CORS_HEADERS });
      }

      const out = scraper.rewritePlaylist(u, text, (abs) => `/api/seg?v=3&vkey=${encodeURIComponent(vkey || '')}&u=${encodeURIComponent(abs)}`);
      return new NextResponse(out, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          ...CORS_HEADERS,
        },
      });
    }

    // Media segment (.ts, .mp4, .m4s)
    let status = 0;
    let headers = {};
    let webStream = null;
    let stream = null;
    let buffer = null;
    try {
      const res = await curlStream(u, range);
      status = res.status;
      headers = res.headers;
      webStream = res.webStream;
      stream = res.stream;
      buffer = res.buffer;
      kill = res.kill;
    } catch (err) {
      console.error('[seg route] curlStream error:', err.message);
    }

    if ((!webStream && !stream && !buffer) || (status !== 200 && status !== 206)) {
      try { kill && kill(); } catch {}
      return NextResponse.json({ error: `Segment failed upstream with status ${status}` }, { status: 502, headers: CORS_HEADERS });
    }

    req.signal.addEventListener('abort', () => {
      try { kill && kill(); } catch {}
    });

    let ct = headers['content-type'];
    if (!ct || ct === 'text/plain') {
      ct = (/\.mp4(\?|$)/i.test(u) || /\.m4s(\?|$)/i.test(u)) ? 'video/mp4' : 'video/mp2t';
    }

    const isPartial = status === 206 || Boolean(range);
    const outHeaders = {
      'Content-Type': ct,
      'Accept-Ranges': 'bytes',
      'Vary': 'Range, Accept-Encoding',
      // No edge caching for segments: stale/corrupt cached segments cause
      // video jumping (frames from wrong positions). Fresh fetch every time
      // ensures correct bytes. The Mumbai region keeps latency low.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...CORS_HEADERS,
    };
    if (headers['content-length']) outHeaders['Content-Length'] = headers['content-length'];
    if (headers['content-range']) outHeaders['Content-Range'] = headers['content-range'];

    const body = webStream || (buffer ? new Uint8Array(buffer) : (stream ? Readable.toWeb(stream) : null));
    return new NextResponse(body, { status, headers: outHeaders });
  } catch (e) {
    try { kill && kill(); } catch {}
    return NextResponse.json({ error: e.message || 'segment failed' }, { status: 502, headers: CORS_HEADERS });
  }
}

