import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const vkey = (searchParams.get('vkey') || '').trim();
    const autoplay = searchParams.get('autoplay') === '1' || searchParams.get('autoplay') === 'true';

    if (!vkey) {
      return new NextResponse('Missing video key', { status: 400 });
    }

    await scraper.warmup();
    let videoData = null;
    try {
      videoData = await scraper.videoInfo(vkey);
    } catch (e) {
      console.warn('[embed route] videoInfo error:', e.message);
    }

    // Direct embed extraction fallback if videoData has no streams
    if (!videoData?.streams || videoData.streams.length === 0) {
      try {
        const { curlText } = await import('../../../lib/cdn.js');
        const res = await curlText(`https://www.pornhub.org/embed/${vkey}`, 12);
        if (res && res.text) {
          const er = scraper.extractStreams ? scraper.extractStreams(res.text) : null;
          if (er && er.streams && er.streams.length > 0) {
            videoData = {
              ...(videoData || {}),
              streams: er.streams
            };
          }
        }
      } catch (e) {
        console.warn('[embed route] Direct embed fallback error:', e.message);
      }
    }

    const title = videoData?.title || 'OrangeHub Player';
    const poster = videoData?.thumbnail ? `/api/img?u=${encodeURIComponent(videoData.thumbnail)}` : '';
    const streams = (videoData?.streams || []).map(s => {
      const alreadyProxied = (s.url || '').startsWith('/api/');
      return {
        quality: s.quality,
        url: (!alreadyProxied && s.url && s.url.startsWith('http')) ? `/api/hls?u=${encodeURIComponent(s.url)}` : s.url,
      };
    });

    const initialSrc = streams[0]?.url || '';

    // Standalone dark-themed embedded player that is 100% UNBLOCKED on all Indian ISPs
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title.replace(/"/g, '&quot;')}</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #wrapper { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; object-fit: contain; background: #000; outline: none; }
    #overlay-play {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.35); cursor: pointer; transition: opacity 0.2s; z-index: 10;
    }
    #overlay-play.hidden { display: none; }
    .play-btn {
      width: 72px; height: 72px; border-radius: 50%; background: #ff9900; color: #000;
      display: flex; align-items: center; justify-content: center; box-shadow: 0 0 30px rgba(255,153,0,0.5);
      border: none; cursor: pointer; transition: transform 0.15s;
    }
    .play-btn:hover { transform: scale(1.08); background: #ffa726; }
    .play-icon { width: 0; height: 0; border-top: 14px solid transparent; border-bottom: 14px solid transparent; border-left: 24px solid #000; margin-left: 5px; }
    #watermark {
      position: absolute; top: 12px; left: 14px; z-index: 5;
      font-size: 13px; font-weight: 900; letter-spacing: 0.5px;
      color: #fff; background: rgba(0,0,0,0.6); padding: 4px 10px; border-radius: 6px;
      backdrop-filter: blur(4px); pointer-events: none; border: 1px solid rgba(255,255,255,0.1);
    }
    #watermark span { color: #ff9900; }
    #loader {
      position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.5); z-index: 8;
    }
    .spinner {
      width: 48px; height: 48px; border: 4px solid rgba(255,153,0,0.2);
      border-top-color: #ff9900; border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="wrapper">
    <video
      id="vid"
      poster="${poster}"
      playsinline
      webkit-playsinline
      x5-playsinline
      controls
      preload="metadata"
    ></video>
    <div id="watermark">Orange<span>Hub</span></div>
    <div id="loader"><div class="spinner"></div></div>
    <div id="overlay-play">
      <button class="play-btn" aria-label="Play video"><div class="play-icon"></div></button>
    </div>
  </div>

  <script>
    const streams = ${JSON.stringify(streams)};
    let curIdx = 0;
    const vid = document.getElementById('vid');
    const overlay = document.getElementById('overlay-play');
    const loader = document.getElementById('loader');
    let hlsInstance = null;

    function playStream(idx) {
      if (!streams || !streams.length || idx >= streams.length) {
        console.warn('No streams available');
        return;
      }
      curIdx = idx;
      const src = streams[idx].url;
      loader.style.display = 'flex';

      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }

      if (window.Hls && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hlsInstance = hls;
        hls.loadSource(src);
        hls.attachMedia(vid);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          loader.style.display = 'none';
          ${autoplay ? "vid.play().catch(() => {}); overlay.classList.add('hidden');" : ""}
        });
        hls.on(Hls.Events.ERROR, (evt, data) => {
          if (data.fatal) {
            hls.destroy();
            if (curIdx < streams.length - 1) {
              playStream(curIdx + 1);
            } else {
              loader.style.display = 'none';
            }
          }
        });
      } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
        vid.src = src;
        vid.addEventListener('loadedmetadata', () => {
          loader.style.display = 'none';
          ${autoplay ? "vid.play().catch(() => {}); overlay.classList.add('hidden');" : ""}
        }, { once: true });
        vid.addEventListener('error', () => {
          if (curIdx < streams.length - 1) playStream(curIdx + 1);
        }, { once: true });
      }
    }

    overlay.addEventListener('click', () => {
      overlay.classList.add('hidden');
      if (!vid.src && !hlsInstance) {
        playStream(0);
      }
      vid.play().catch(() => {
        vid.muted = true;
        vid.play().catch(() => {});
      });
    });

    vid.addEventListener('play', () => overlay.classList.add('hidden'));
    vid.addEventListener('pause', () => {
      if (vid.currentTime === 0 || vid.ended) overlay.classList.remove('hidden');
    });
    vid.addEventListener('waiting', () => loader.style.display = 'flex');
    vid.addEventListener('playing', () => loader.style.display = 'none');

    ${initialSrc ? 'playStream(0);' : ''}
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new NextResponse('Internal error', { status: 500 });
  }
}
