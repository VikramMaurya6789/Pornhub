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
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
apt-get update -qq
apt-get install -y -qq caddy > /dev/null

echo "=== [4/6] Proxy app ==="
mkdir -p /opt/oh-proxy
cp proxy.js /opt/oh-proxy/proxy.js

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

systemctl daemon-reload
systemctl enable --now oh-proxy
sleep 2
systemctl is-active --quiet oh-proxy && echo "proxy: RUNNING" || (echo "proxy: FAILED"; journalctl -u oh-proxy -n 20 --no-pager)

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
systemctl reload caddy
echo "caddy: reloaded (cert will issue on first HTTPS hit)"

echo "=== [6/6] Firewall ==="
ufw --force enable > /dev/null 2>&1 || true
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
ufw allow 22/tcp > /dev/null
echo "firewall: 22/80/443 open"

echo ""
echo "=== DONE ==="
echo "Proxy: http://127.0.0.1:3001/seg (via Caddy)"
echo "Public: https://$DOMAIN/seg?u=<encoded-cdn-url>"
echo ""
echo "Test: curl -I https://$DOMAIN/seg?u=https://example.com/x.ts"
echo "(expect 403 host-not-allowed = proxy is up and filtering correctly)"
