#!/bin/bash
# OrangeHub Oracle Cloud setup — run as root (or with sudo) on a fresh
# Ubuntu 24.04 ARM VM (VM.Standard.A1.Flex, 2 OCPU / 12 GB).
# Usage: sudo bash server-setup.sh
set -e

echo "=== [1/5] System + Docker ==="
apt-get update -qq
apt-get install -y -qq ca-certificates curl git ufw > /dev/null
if ! command -v docker > /dev/null; then
  curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
fi
docker --version

echo "=== [2/5] Firewall (UFW + Oracle iptables) ==="
ufw allow 22/tcp > /dev/null 2>&1 || true
ufw allow 80/tcp > /dev/null 2>&1 || true
ufw allow 443/tcp > /dev/null 2>&1 || true
ufw --force enable > /dev/null 2>&1 || true
# OCI Ubuntu images ship restrictive iptables rules — open web ports there too
iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
if command -v netfilter-persistent > /dev/null; then
  netfilter-persistent save > /dev/null 2>&1 || true
fi

echo "=== [3/5] Clone OrangeHub ==="
mkdir -p /opt
if [ ! -d /opt/orangehub/.git ]; then
  git clone https://github.com/VikramMaurya6789/Pornhub.git /opt/orangehub
fi
cd /opt/orangehub/deploy/oracle

echo "=== [4/5] Environment file ==="
if [ ! -f .env ]; then
  cp .env.example .env
  # generate a random DB password
  RANDPW=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)
  sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${RANDPW}/" .env
  echo "Created .env with a random DB_PASSWORD."
  echo ">>> EDIT /opt/orangehub/deploy/oracle/.env now:"
  echo "    SITE_HOST / SITE_URL  (your domain -> this VM's public IP)"
  echo "    GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI"
  echo ">>> Then re-run: cd /opt/orangehub/deploy/oracle && docker compose up -d --build"
  exit 0
fi

echo "=== [5/5] Build + start ==="
docker compose up -d --build
echo "Done. Check: docker compose ps ; docker compose logs -f app"
