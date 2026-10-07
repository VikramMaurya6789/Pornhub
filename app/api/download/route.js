import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';
import { curlStream } from '../../../lib/cdn.js';
import { Readable } from 'stream';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/download?vkey=XXX
//   → JSON: { downloads: [{ quality, url: "/api/download?vkey=XXX&q=720&file=1" }] }
// GET /api/download?vkey=XXX&q=720&file=1
//   → Streams the MP4 file with Content-Disposition: attachment
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const vkey = searchParams.get('vkey');
    const quality = searchParams.get('q');
    const file = searchParams.get('file');

    if (!vkey) {
      return NextResponse.json({ error: 'vkey required' }, { status: 400, headers: CORS_HEADERS });
    }

    const info = await scraper.videoInfo(vkey, false);
    const downloads = Array.isArray(info?.downloads) ? info.downloads : [];

    if (!file) {
      // List available qualities
      const list = downloads.map((d) => ({
        quality: d.quality,
        url: `/api/download?vkey=${encodeURIComponent(vkey)}&q=${encodeURIComponent(d.quality)}&file=1`,
      }));
      return NextResponse.json(
        { vkey, downloads: list },
        { headers: { 'Cache-Control': 'public, s-maxage=300', ...CORS_HEADERS } }
      );
    }

    // Stream the actual file
    const match = downloads.find((d) => String(d.quality) === String(quality)) || downloads[0];
    if (!match || !match.url) {
      return NextResponse.json({ error: 'Download not available for this quality' }, { status: 404, headers: CORS_HEADERS });
    }

    const range = req.headers.get('range');
    let res;
    try {
      res = await curlStream(match.url, range);
    } catch (e) {
      return NextResponse.json({ error: 'Download failed: ' + e.message }, { status: 502, headers: CORS_HEADERS });
    }

    const { status, headers, webStream, stream, buffer } = res;
    if (!webStream && !stream && !buffer) {
      return NextResponse.json({ error: 'Download failed upstream' }, { status: 502, headers: CORS_HEADERS });
    }

    const safeTitle = (info?.title || vkey).replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 60);
    const filename = `${safeTitle}_${match.quality}p.mp4`;

    const outHeaders = {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Accept-Ranges': 'bytes',
      ...CORS_HEADERS,
    };
    if (headers['content-length']) outHeaders['Content-Length'] = headers['content-length'];
    if (headers['content-range']) outHeaders['Content-Range'] = headers['content-range'];

    const body = webStream || (buffer ? new Uint8Array(buffer) : (stream ? Readable.toWeb(stream) : null));
    return new NextResponse(body, { status, headers: outHeaders });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'download failed' }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function HEAD(req) {
  const res = await GET(req);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
