# OrangeHub

A Pornhub-style adult video website built with **Next.js 16 + Tailwind CSS**,
powered by live data scraped from Pornhub using concepts from the
[`JustalK/PORNHUB-API`](https://github.com/JustalK/PORNHUB-API) GitHub repo
(MIT). The repo's own `page()` scraper is stale against Pornhub's current
markup, so this project ships a custom cheerio-based scraper (`lib/scraper.js`)
with fixed selectors, plus a stream proxy that makes HLS playback actually work.

> **Branding note:** the UI uses original "OrangeHub" branding — it does not
> copy Pornhub's logo, name, or assets.

## Features

- **Home** — hero spotlight + Recommended / Hottest / Most viewed sections
- **Video pages** — HLS player (hls.js) with Auto/1080/720/480/240 quality
  selector, likes, share (copy link), uploader card, tags, categories,
  pornstars, related videos
- **Download** — per-quality MP4 download (server remuxes HLS → MP4 with ffmpeg)
- **Search** — with sort (relevant / viewed / rated / longest / newest) + pagination
- **Categories** — full category grid + per-category listing pages
- **Curated lists** — Hottest, Most Viewed, Top Rated, Newest
- **18+ age gate**, dark UI, orange brand color, smooth card/fade animations,
  skeleton loaders, fully responsive

## How it works

| Layer | What it does |
|---|---|
| `lib/scraper.js` | Cheerio scraper: feeds, search, categories, video info (incl. `mediaDefinitions` HLS URLs), TTL cache, cookie jar, retries |
| `lib/cdn.js` | CDN fetching via the `curl` binary (Pornhub's stream CDN rejects Node's TLS fingerprint with HTTP 410) |
| `app/api/*` | JSON APIs: `feed`, `search`, `video`, `categories`, `category`; proxies: `img` (thumbnails), `hls` (playlists), `seg` (segments, Range-aware), `download` (ffmpeg MP4 remux) |
| `components/*`, `app/*` | React UI |

Stream tokens are signed and short-lived: video metadata is cached 10 min,
stream URLs only 2 min. All HLS requests are proxied server-side and playlist
URIs rewritten to `/api/seg`, so playback works from any client IP.

## Requirements

- Node.js 18+
- `ffmpeg` on PATH (only needed for the Download button)
- `curl` on PATH (needed for stream proxying)

## Run

```bash
npm install
npm run dev      # dev server → http://localhost:3000
# or
npm run build && npm start
```

Windows: same commands in PowerShell. Optional: copy `.env.example` to `.env`.

## Environment

| Var | Purpose |
|---|---|
| `PROXY_URL` | Optional HTTP(S) proxy for all upstream requests (e.g. `http://user:pass@host:port`). Useful if your network blocks or rate-limits Pornhub. |

## Project structure

```
app/                 # Next.js app router: pages + API routes
  api/feed|search|video|categories|category/   # JSON data APIs
  api/img|hls|seg/                             # media proxies
  api/download/                                # HLS→MP4 download
  page.js            # home        watch/[vkey]/  search/
  categories/  category/  list/[type]/
components/          # Header, AgeGate, VideoCard, Player (hls.js), UI bits, SVG icons
lib/
  scraper.js         # the Pornhub scraper
  cdn.js             # curl-based CDN fetcher
```

## Legal / safety

- 18+ age gate on entry; footer notes all models were 18+.
- This is a demo aggregator: **no video files are hosted here** — streams and
  thumbnails are proxied from the third-party source at request time.
- Respect Pornhub's Terms of Service and your local laws before deploying
  publicly. For production use add proper rate limiting, DMCA/privacy pages,
  and your own legal review.

## Credits

Scraping approach inspired by [JustalK/PORNHUB-API](https://github.com/JustalK/PORNHUB-API)
(MIT License). All trademarks belong to their owners.
