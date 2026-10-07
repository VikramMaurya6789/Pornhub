import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';
import { curlStream, curlText } from '../../../lib/cdn.js';
import { Readable } from 'stream';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Parse HLS master playlist to extract variant qualities
async function getHLSVariants(masterUrl) {
  try {
    const res = await curlText(masterUrl, 10);
    if (!res || res.status !== 200 || !res.text) return [];
    const lines = res.text.split('\n');
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const resMatch = line.match(/RESOLUTION=\d+x(\d+)/);
        const bwMatch = line.match(/BANDWIDTH=(\d+)/);
        const urlLine = (lines[i + 1] || '').trim();
        if (urlLine && !urlLine.startsWith('#')) {
          const absUrl = new URL(urlLine, masterUrl).toString();
          const quality = resMatch ? resMatch[1] : (bwMatch ? Math.round(parseInt(bwMatch[1]) / 1000) + 'k' : 'auto');
          variants.push({ quality, url: absUrl, format: 'hls' });
        }
      }
    }
    // Deduplicate by quality, keep highest bandwidth
    const seen = new Map();
    for (const v of variants) {
      if (!seen.has(v.quality)) seen.set(v.quality, v);
    }
    return Array.from(seen.values()).sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
  } catch {
    return [];
  }
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
    const streams = Array.isArray(info?.streams) ? info.streams : [];

    if (!file) {
      // List available qualities: MP4 first, then HLS variants for every quality
      const list = downloads.map((d) => ({
        quality: d.quality,
        format: 'mp4',
        url: `/api/download?vkey=${encodeURIComponent(vkey)}&q=${encodeURIComponent(d.quality)}&file=1&format=mp4`,
      }));

      // Always add HLS variants too (gives every quality: 240p/480p/720p/1080p)
      // These play in VLC/MX Player. MP4s are preferred when available.
      if (streams.length > 0) {
        const masterUrl = streams[0].url;
        let upstreamMaster = masterUrl;
        try {
          if (masterUrl.startsWith('/api/')) {
            const u = new URL(masterUrl, req.url);
            upstreamMaster = u.searchParams.get('u') || masterUrl;
          }
        } catch {}
        const variants = await getHLSVariants(upstreamMaster);
        const mp4Qualities = new Set(list.map((x) => String(x.quality)));
        for (const v of variants) {
          // Skip if we already have this quality as MP4
          if (mp4Qualities.has(String(v.quality))) continue;
          list.push({
            quality: v.quality,
            format: 'hls',
            url: `/api/download?vkey=${encodeURIComponent(vkey)}&q=${encodeURIComponent(v.quality)}&file=1&format=hls&hlsurl=${encodeURIComponent(v.url)}`,
          });
        }
        // Sort: MP4s first (highest quality), then HLS (highest quality)
        list.sort((a, b) => {
          if (a.format !== b.format) return a.format === 'mp4' ? -1 : 1;
          return (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0);
        });
      }

      return NextResponse.json(
        { vkey, downloads: list },
        { headers: { 'Cache-Control': 'public, s-maxage=300', ...CORS_HEADERS } }
      );
    }

    // Stream the actual file
    const format = searchParams.get('format') || 'mp4';
    const hlsurl = searchParams.get('hlsurl');

    if (format === 'hls' && hlsurl) {
      // Proxy the HLS variant playlist as a downloadable file
      const range = req.headers.get('range');
      let res;
      try {
        res = await curlStream(hlsurl, range);
      } catch (e) {
        return NextResponse.json({ error: 'Download failed: ' + e.message }, { status: 502, headers: CORS_HEADERS });
      }
      const { status, headers, webStream, stream, buffer } = res;
      if (!webStream && !stream && !buffer) {
        return NextResponse.json({ error: 'Download failed upstream' }, { status: 502, headers: CORS_HEADERS });
      }
      const safeTitle = (info?.title || vkey).replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 60);
      const filename = `${safeTitle}_${quality}p.m3u8`;
      // Rewrite the playlist to use absolute proxied URLs so it plays standalone
      let playlistText = '';
      try {
        if (buffer) playlistText = Buffer.from(buffer).toString('utf8');
      } catch {}
      // If we got the playlist content, rewrite segment URLs to proxied absolute URLs
      if (playlistText && playlistText.includes('#EXTM3U')) {
        const lines = playlistText.split('\n');
        const rewritten = lines.map((line) => {
          const t = line.trim();
          if (t && !t.startsWith('#')) {
            try {
              const abs = new URL(t, hlsurl).toString();
              return `/api/seg?u=${encodeURIComponent(abs)}`;
            } catch { return line; }
          }
          return line;
        });
        playlistText = rewritten.join('\n');
        const outHeaders = {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...CORS_HEADERS,
        };
        return new NextResponse(playlistText, { status: 200, headers: outHeaders });
      }
      // Fallback: stream as-is
      const outHeaders = {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Content-Disposition': `attachment; filename="${filename}"`,
        ...CORS_HEADERS,
      };
      const body = webStream || (buffer ? new Uint8Array(buffer) : (stream ? Readable.toWeb(stream) : null));
      return new NextResponse(body, { status, headers: outHeaders });
    }

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
