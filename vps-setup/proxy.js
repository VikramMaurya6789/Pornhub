// OrangeHub Video Proxy — runs on VPS
// Forwards HLS segments from upstream CDN to the player
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 3001;
// Change this to your frontend origin for tighter CORS (or keep * for now)
const ALLOW_ORIGIN = '*';

function fetchUpstream(targetUrl, rangeHeader) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer': 'https://www.pornhub.com/',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      },
    };
    if (rangeHeader) opts.headers['Range'] = rangeHeader;

    const req = lib.request(opts, (res) => {
      resolve(res);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('upstream timeout')); });
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Origin',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  if (reqUrl.pathname !== '/seg') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  const u = reqUrl.searchParams.get('u');
  if (!u || !/^https?:\/\//.test(u)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'bad url' }));
    return;
  }

  // Only allow known upstream CDN hosts
  let host = '';
  try { host = new URL(u).hostname.toLowerCase(); } catch {}
  const allowed = /(phncdn\.com|pornhub\.com|trafficjunky\.com)$/i.test(host);
  if (!allowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'host not allowed' }));
    return;
  }

  const range = req.headers['range'];
  let upstream;
  try {
    upstream = await fetchUpstream(u, range);
  } catch (e) {
    res.writeHead(502, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    });
    res.end(JSON.stringify({ error: 'upstream failed: ' + e.message }));
    return;
  }

  const status = upstream.statusCode;
  if (status !== 200 && status !== 206) {
    upstream.resume();
    res.writeHead(502, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    });
    res.end(JSON.stringify({ error: 'upstream status ' + status }));
    return;
  }

  let ct = upstream.headers['content-type'];
  if (!ct || ct === 'text/plain') {
    ct = (/\.mp4(\?|$)/i.test(u) || /\.m4s(\?|$)/i.test(u)) ? 'video/mp4' : 'video/mp2t';
  }

  const outHeaders = {
    'Content-Type': ct,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
  };
  if (upstream.headers['content-length']) outHeaders['Content-Length'] = upstream.headers['content-length'];
  if (upstream.headers['content-range']) outHeaders['Content-Range'] = upstream.headers['content-range'];

  res.writeHead(status, outHeaders);

  // 12s inactivity timeout — abort if upstream stalls
  let lastData = Date.now();
  const timer = setInterval(() => {
    if (Date.now() - lastData > 12000) {
      clearInterval(timer);
      try { upstream.destroy(); } catch {}
      try { res.destroy(); } catch {}
    }
  }, 2000);

  upstream.on('data', () => { lastData = Date.now(); });
  upstream.on('end', () => clearInterval(timer));
  upstream.on('error', () => { clearInterval(timer); try { res.end(); } catch {} });
  req.on('close', () => { clearInterval(timer); try { upstream.destroy(); } catch {} });

  upstream.pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[proxy] listening on 127.0.0.1:${PORT}`);
});
