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

const proxied = (v) => v ? `/api/img?u=${encodeURIComponent(v)}` : null;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const vkey = (searchParams.get('vkey') || '').trim();
  const refresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true';

  if (!vkey) {
    return NextResponse.json({ error: 'missing vkey' }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    await scraper.warmup();
    const v = await scraper.videoInfo(vkey, refresh);
    if (!v) {
      return NextResponse.json({ error: 'video not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const activeStreams = (v.streams && v.streams.length > 0) ? v.streams : [];
    const validComments = scraper.filterValidComments
      ? scraper.filterValidComments(v.comments)
      : (Array.isArray(v.comments) ? v.comments.filter(c => c && c.message && !String(c.message).includes('[[')) : []);

    return NextResponse.json({
      ...v,
      duration: v.duration && v.duration !== '0:00' && v.duration !== '0' ? v.duration : '--:--',
      durationSec: typeof v.durationSec === 'number' && v.durationSec > 0 ? v.durationSec : (scraper.parseDurationSec ? scraper.parseDurationSec(v.duration) : null),
      thumbnail: proxied(v.thumbnail) || '/og-image.jpg',
      authorAvatar: v.authorAvatar && /phncdn\.com/i.test(v.authorAvatar) ? proxied(v.authorAvatar) : v.authorAvatar,
      comments: validComments.map(c => ({
        ...c,
        avatar: c.avatar && /phncdn\.com/i.test(c.avatar) ? proxied(c.avatar) : c.avatar,
      })),
      streams: activeStreams.map(s => {
        const alreadyProxied = (s.url || '').startsWith('/api/');
        const isHttp = /^https?:\/\//i.test(s.url || '');
        return {
          quality: s.quality,
          url: (!alreadyProxied && isHttp) ? `/api/hls?vkey=${encodeURIComponent(vkey)}&u=${encodeURIComponent(s.url)}` : s.url,
        };
      }),
      related: (v.related || []).map(r => ({ ...r, thumbnail: proxied(r.thumbnail) || '/og-image.jpg' })),
    }, {
      headers: {
        'Cache-Control': refresh ? 'no-store, no-cache, must-revalidate' : 'public, s-maxage=120, stale-while-revalidate=300',
        ...CORS_HEADERS,
      }
    });
  } catch (e) {
    if (e.status === 404 || e.message === 'video not found' || (e.message && e.message.includes('not found'))) {
      return NextResponse.json({ error: 'video not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const pool = scraper.getFallbackVideos ? scraper.getFallbackVideos() : [];
    const matched = pool.find(c => c.vkey === vkey) || null;
    if (!matched) {
      return NextResponse.json({ error: 'video not found' }, { status: 404, headers: CORS_HEADERS });
    }

    let streams = [];
    try {
      const { curlText } = await import('../../../lib/cdn.js');
      const res = await curlText(`https://www.pornhub.com/embed/${vkey}`, 12);
      if (res && res.text) {
        const er = scraper.extractStreams ? scraper.extractStreams(res.text) : null;
        if (er && er.streams && er.streams.length > 0) {
          streams = er.streams.map(s => ({
            quality: s.quality,
            url: `/api/hls?vkey=${encodeURIComponent(vkey)}&u=${encodeURIComponent(s.url)}`,
          }));
        }
      }
    } catch {}

    if (streams.length === 0) {
      streams = [{ quality: '1080', url: `/api/hls?vkey=6a8c673a68504` }];
    }

    const fallbackSec = matched.durationSec || (scraper.parseDurationSec ? scraper.parseDurationSec(matched.duration) : null);

    return NextResponse.json({
      vkey,
      title: matched.title,
      thumbnail: proxied(matched.thumbnail) || '/og-image.jpg',
      duration: matched.duration && matched.duration !== '0:00' && matched.duration !== '0' ? matched.duration : '--:--',
      durationSec: fallbackSec,
      views: matched.views || '240K views',
      author: matched.author || 'Verified Creator',
      authorAvatar: `/api/avatar?name=${encodeURIComponent(matched.author || 'Creator')}`,
      streams,
      related: pool.filter(r => r.vkey !== vkey).slice(0, 12).map(r => ({ ...r, thumbnail: proxied(r.thumbnail) || '/og-image.jpg' })),
      comments: [],
      authorBio: null,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        ...CORS_HEADERS,
      }
    });
  }
}
