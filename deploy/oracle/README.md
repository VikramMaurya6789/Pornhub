# OrangeHub on Oracle Cloud Always Free

Docker Compose stack: Next.js app + Postgres 16 + Caddy (auto HTTPS).
Runs on the free ARM VM (2 OCPU / 12 GB) with 10 TB/month bandwidth —
no more Vercel quota pauses.

## First-time setup (on the VM, as root)

1. `git clone https://github.com/VikramMaurya6789/Pornhub.git /opt/orangehub`
2. `sudo bash /opt/orangehub/deploy/oracle/server-setup.sh`
   - Installs Docker, opens ports 80/443, clones the repo, creates `.env`
     with a random DB password.
3. Edit `/opt/orangehub/deploy/oracle/.env`:
   - `SITE_HOST` / `SITE_URL` — your domain (A record → VM public IP)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
     (`https://<SITE_HOST>/api/auth/google/callback`; add the same URI in
     the Google Cloud Console OAuth client)
4. `cd /opt/orangehub/deploy/oracle && docker compose up -d --build`
5. Watch it come up: `docker compose logs -f app`

## Updating

`bash /opt/orangehub/deploy/oracle/update.sh` — pulls latest main,
rebuilds, restarts. Postgres data persists in the `pgdata` volume.

## Notes

- No `.env` values are committed — the real `.env` lives only on the VM.
- Oracle idle rule: keep a tiny cron/systemd timer hitting the VM (or just
  use the site) so the always-free instance isn't reclaimed for idleness.
- Caddy stores TLS certs in the `caddydata` volume — they renew automatically.
