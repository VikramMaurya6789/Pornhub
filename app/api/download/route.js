import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';
import { curlText } from '../../../lib/cdn.js';

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
    const text = res.text;
    // Must be a master playlist (contains STREAM-INF), not a media playlist
    if (!text.includes('#EXT-X-STREAM-INF')) {
      // It's already a variant playlist - treat as single quality
      // Try to guess quality from URL
      const m = masterUrl.match(/(\d{3,4})[pP]/);
      return [{ quality: m ? m[1] : 'auto', url: masterUrl, format: 'hls' }];
    }
    const lines = text.split('\n');
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toUpperCase().startsWith('#EXT-X-STREAM-INF')) {
        const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
        const urlLine = (lines[i + 1] || '').trim();
        if (urlLine && !urlLine.startsWith('#')) {
          let absUrl;
          try {
            absUrl = new URL(urlLine, masterUrl).toString();
          } catch { continue; }
          let quality;
          if (resMatch) {
            quality = resMatch[1];
          } else if (bwMatch) {
            // Estimate quality from bandwidth: <1M=360, <2.5M=480, <5M=720, else 1080
            const bw = parseInt(bwMatch[1]);
            quality = bw < 1000000 ? '360' : bw < 2500000 ? '480' : bw < 5000000 ? '720' : '1080';
          } else {
            quality = 'auto';
          }
          variants.push({ quality, url: absUrl, format: 'hls' });
        }
      }
    }
    // Deduplicate by quality, keep first occurrence
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

    // For HLS: redirect to the variant playlist (browser/VLC handles it)
    // For MP4: redirect directly to upstream (bypasses Vercel timeout for large files)
    const format = searchParams.get('format') || 'mp4';
    const hlsurl = searchParams.get('hlsurl');

    if (format === 'hls' && hlsurl) {
      // Redirect to HLS variant - VLC/MX Player can play/download it
      return NextResponse.redirect(hlsurl, { headers: CORS_HEADERS });
    }

    const match = downloads.find((d) => String(d.quality) === String(quality)) || downloads[0];
    if (!match || !match.url) {
      return NextResponse.json({ error: 'Download not available for this quality' }, { status: 404, headers: CORS_HEADERS });
    }

    // Redirect to upstream MP4 (avoids Vercel serverless timeout on large files)
    // The browser downloads directly from the CDN - full file, no interruption.
    return NextResponse.redirect(match.url, { headers: CORS_HEADERS });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'download failed' }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function HEAD(req) {
  const res = await GET(req);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
