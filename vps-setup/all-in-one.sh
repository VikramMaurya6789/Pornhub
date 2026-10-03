#!/bin/bash
# OrangeHub VPS Setup — run as root on fresh Ubuntu 24.04
# Usage: sudo bash setup.sh your-subdomain.example.com
set -e

DOMAIN="$1"
if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo bash setup.sh video.yourdomain.com"
  exit 1
fi

echo "=== [1/6] System update ==="
apt-get update -qq
apt-get install -y -qq curl ca-certificates ufw > /dev/null

echo "=== [2/6] Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y -qq nodejs > /dev/null
node --version

echo "=== [3/6] Caddy (auto HTTPS) ==="
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https > /dev/null
rm -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
apt-get update -qq
apt-get install -y -qq caddy > /dev/null

echo "=== [4/6] Proxy app ==="
mkdir -p /opt/oh-proxy
cat > /opt/oh-proxy/proxy.js <<"PROXYEOF"
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
PROXYEOF

cat > /etc/systemd/system/oh-proxy.service <<'EOF'
[Unit]
Description=OrangeHub Video Proxy
After=network.target

[Service]
Type=simple
User=nobody
WorkingDirectory=/opt/oh-proxy
ExecStart=/usr/bin/node /opt/oh-proxy/proxy.js
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Start proxy: systemd if available, else nohup (Docker/containers)
if [ -d /run/systemd/system ]; then
  systemctl daemon-reload
  systemctl enable --now oh-proxy
  sleep 2
  systemctl is-active --quiet oh-proxy && echo "proxy: RUNNING (systemd)" || (echo "proxy: FAILED"; journalctl -u oh-proxy -n 20 --no-pager)
else
  echo "no systemd detected, using nohup"
  pkill -f "node /opt/oh-proxy/proxy.js" 2>/dev/null || true
  nohup node /opt/oh-proxy/proxy.js > /var/log/oh-proxy.log 2>&1 &
  sleep 2
  if pgrep -f "node /opt/oh-proxy/proxy.js" > /dev/null; then
    echo "proxy: RUNNING (nohup, pid $(pgrep -f 'node /opt/oh-proxy/proxy.js' | head -1))"
  else
    echo "proxy: FAILED"; tail -20 /var/log/oh-proxy.log
  fi
  # Keep alive across shell exits: add to crontab reboot check
  (crontab -l 2>/dev/null | grep -v oh-proxy; echo "@reboot nohup node /opt/oh-proxy/proxy.js > /var/log/oh-proxy.log 2>&1 &") | crontab -
fi

echo "=== [5/6] Caddy reverse proxy ==="
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  reverse_proxy 127.0.0.1:3001
  header {
    # security headers
    X-Content-Type-Options nosniff
  }
}
EOF
if [ -d /run/systemd/system ]; then
  systemctl reload caddy
  echo "caddy: reloaded via systemd"
else
  pkill caddy 2>/dev/null || true
  sleep 1
  nohup caddy run --config /etc/caddy/Caddyfile --adapter caddyfile > /var/log/caddy.log 2>&1 &
  sleep 3
  if pgrep -x caddy > /dev/null; then
    echo "caddy: RUNNING (pid $(pgrep -x caddy | head -1))"
  else
    echo "caddy: FAILED"; tail -20 /var/log/caddy.log
  fi
  (crontab -l 2>/dev/null | grep -v "caddy run"; echo "@reboot nohup caddy run --config /etc/caddy/Caddyfile --adapter caddyfile > /var/log/caddy.log 2>&1 &") | crontab -
fi
echo "(cert will issue on first HTTPS hit)"

echo "=== [6/6] Firewall ==="
if command -v ufw > /dev/null 2>&1; then
  ufw --force enable > /dev/null 2>&1 || true
  ufw allow 80/tcp > /dev/null
  ufw allow 443/tcp > /dev/null
  ufw allow 22/tcp > /dev/null
  echo "firewall: 22/80/443 open"
else
  echo "firewall: ufw not available, skipping (use provider firewall)"
fi

echo ""
echo "=== DONE ==="
echo "Proxy: http://127.0.0.1:3001/seg (via Caddy)"
echo "Public: https://$DOMAIN/seg?u=<encoded-cdn-url>"
echo ""
echo "Test: curl -I https://$DOMAIN/seg?u=https://example.com/x.ts"
echo "(expect 403 host-not-allowed = proxy is up and filtering correctly)"
