#!/bin/bash
# Pull latest code and redeploy. Run on the VM: bash update.sh
set -e
cd /opt/orangehub
git pull --ff-only
cd deploy/oracle
docker compose up -d --build
docker image prune -f > /dev/null 2>&1 || true
echo "Updated. Verify: docker compose ps"
