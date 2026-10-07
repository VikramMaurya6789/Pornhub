/**
 * OrangeHub scraper — cheerio-based scraper for Pornhub listing + video pages.
 * Built on top of the @justalk/pornhub-api GitHub repo concepts, with fixed
 * selectors for the current site layout (the repo's page() scraper is stale).
 * Includes resilient local fallback data if the upstream source is blocked by ISP/network.
 */
const cheerio = require('cheerio');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { curlText } = require('./cdn.js');
const { CATEGORIES, DEFAULT_STREAMS, SEED_VIDEOS } = require('./seedData.js');
const { getVideoCache, setVideoCache, getFeedCache, setFeedCache } = require('./cache.js');

const BASE = 'https://www.pornhub.org';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const PERMANENT_FALLBACK_THUMBS = [
  'https://ei.phncdn.com/videos/202406/20/454069141/original/(m=eafTGgaaaa)(mh=R176HDeU77GI7aqL)12.jpg',
  'https://ei.phncdn.com/videos/202401/03/445821221/thumbs_10/(m=eafTGgaaaa)(mh=YoGTgQNERVhXaB40)14.jpg',
  'https://ei.phncdn.com/videos/202406/19/454042771/original/(m=eafTGgaaaa)(mh=Gi6cuTn5wVOb-EA_)8.jpg',
  'https://ei.phncdn.com/videos/202311/11/442807281/thumbs_10/(m=eafTGgaaaa)(mh=XNxYhpUeUVgVWpXm)2.jpg',
  'https://ei.phncdn.com/videos/202310/15/441229171/original/(m=eafTGgaaaa)(mh=t_3SiJLA_af4oOth)14.jpg',
  'https://ei.phncdn.com/videos/202409/18/457931731/original/(m=qH2T1UZbeafTGgaaaa)(mh=mddBO_m56bH9dDNJ)0.jpg',
  'https://ei.phncdn.com/videos/202506/05/469829265/original/(m=qZMN7K0beafTGgaaaa)(mh=BaZhcCmWIy6capaI)0.jpg',
  'https://ei.phncdn.com/videos/202408/24/456878811/original/(m=eafTGgaaaa)(mh=yRooN55YAE3Wqh_Y)16.jpg',
  'https://ei.phncdn.com/videos/202311/05/442443421/original/(m=eafTGgaaaa)(mh=lsy2TCE9bZZIluH7)13.jpg',
  'https://ei.phncdn.com/videos/202504/06/466875585/original/(m=eafTGgaaaa)(mh=Bvf0FSqwIKsYF5dK)10.jpg',
  'https://ei.phncdn.com/videos/202503/25/466308355/original/(m=eafTGgaaaa)(mh=6egw3dhNTOGgGUd3)15.jpg',
  'https://ei.phncdn.com/videos/202410/05/458700881/original/(m=eafTGgaaaa)(mh=C6tH_z6SRwIAIhWu)7.jpg',
  'https://ei.phncdn.com/videos/202308/27/438266681/original/(m=eafTGgaaaa)(mh=oU6w4FJ1d_sSqGZQ)10.jpg',
  'https://ei.phncdn.com/videos/202404/22/451425251/original/(m=eafTGgaaaa)(mh=ilcI3NrS5kZcjyU6)3.jpg',
  'https://ei.phncdn.com/videos/202403/27/450211301/original/(m=eafTGgaaaa)(mh=vZs8sEELUEsm9ozQ)2.jpg',
  'https://ei.phncdn.com/videos/202503/03/465263465/original/(m=eafTGgaaaa)(mh=NRLkAUUUbeSb2z9h)13.jpg'
];

function getPermanentFallbackThumbnail(title = '', seed = '') {
  let h = 0;
  const str = String(seed || title || 'ph');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return PERMANENT_FALLBACK_THUMBS[h % PERMANENT_FALLBACK_THUMBS.length];
}

let _proxyAgent = null;
function dispatcher() {
  if (process.env.PROXY_URL) {
    if (!_proxyAgent) {
      const { ProxyAgent } = require('undici');
      _proxyAgent = new ProxyAgent(process.env.PROXY_URL);
    }
    return _proxyAgent;
  }
  return undefined;
}

/* Minimal cookie jar — keeps a browser-like session so Pornhub stops
   serving degraded page variants to "new" visitors. */
const _jar = new Map();
function storeCookies(res) {
  try {
    const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of list) {
      const pair = c.split(';')[0];
      const i = pair.indexOf('=');
      if (i > 0) _jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  } catch { /* ignore */ }
}
function cookieHeader() {
  const base = { age_verified: '1', accessAgeDisclaimerPH: '1', platform: 'pc' };
  for (const [k, v] of _jar) base[k] = v;
  return Object.entries(base).map(([k, v]) => `${k}=${v}`).join('; ');
}

function getFallbackHtml(url) {
  try {
    const root = process.cwd();
    const u = String(url || '');
    if (u.includes('/categories')) {
      const p = path.join(root, 'cats.html');
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    }
    // Only return page.html / t.html if url actually matches their exact vkey!
    if (u.includes('ph62c3e1e5564fa')) {
      const p1 = path.join(root, 'page.html');
      if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
    }
    if (u.includes('6a594a180f651')) {
      const p2 = path.join(root, 't.html');
      if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
    }
    if (u.includes('/video/search') || u.includes('/search')) {
      const ps = path.join(root, 'search.html');
      if (fs.existsSync(ps)) return fs.readFileSync(ps, 'utf8');
    }
  } catch (err) {
    console.error('[scraper] Fallback read error:', err.message);
  }
  return null;
}

let _upstreamFailedUntil = 0;

async function fetchHtml(url, tries = 2) {
  let targetUrl = url;
  if (targetUrl.includes('pornhub.com')) {
    targetUrl = targetUrl.replace('pornhub.com', 'pornhub.org');
  }

  for (let i = 0; i < tries; i++) {
    try {
      const { status, text } = await curlText(targetUrl, 15);
      if (status === 200 && text && text.length > 20000) {
        _upstreamFailedUntil = 0;
        return text;
      }
    } catch (e) {
      if (i < tries - 1) await new Promise(r => setTimeout(r, 400));
    }
  }

  if (targetUrl.includes('pornhub.org')) {
    try {
      const comUrl = targetUrl.replace('pornhub.org', 'pornhub.com');
      const { status, text } = await curlText(comUrl, 15);
      if (status === 200 && text && text.length > 20000) {
        return text;
      }
    } catch {}
  }

  const fallback = getFallbackHtml(url);
  if (fallback) return fallback;
  return '<html><body></body></html>';
}

/* ---------------- tiny TTL cache ---------------- */
const _cache = new Map();
function getCache(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.val;
}
function setCache(key, val, ttlMs) {
  _cache.set(key, { val, exp: Date.now() + ttlMs });
  if (_cache.size > 400) { const k = _cache.keys().next().value; _cache.delete(k); }
}
async function cached(key, ttlMs, fn) {
  const hit = getCache(key);
  if (hit) return hit;
  const val = await fn();
  setCache(key, val, ttlMs);
  return val;
}

/* Retry wrapper for endpoints that occasionally return a wrong page variant */
async function withRetry(fn, tries = 2, label = '') {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const val = await fn();
      const n = Array.isArray(val) ? val.length : (val && val.videos ? val.videos.length : 1);
      if (n === 0) throw new Error(`empty result for ${label}`);
      return val;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
  throw lastErr;
}

/* ---------------- card parsing ---------------- */
function absUrl(href) {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return BASE + href;
}

const BAN_WORDS = [
  'podcast', 'unboxing', 'interview', 'vlog', 'motovlog', 'minifigure',
  'lego', 'yugioh', 'megatin', 'radio', 'how to verify', 'reacting to',
  'qribs', 'addiction to adult content', 'loss of time to criticize',
  'behind the scenes', 'talk show', 'teddy tarantino', 'essential for fans',
  'turned extremesces into a brand', 'in the kitchen!', 'mukbang',
  'living with uncontrollable breast growth', 'spills dirty secrets',
  'how to become a verified creator', 'directing',
  'navigating the new era', '#vergeday', 'lie detecor test', 'lie detector',
  'unfiltered', 'performer center', 'camming success',
  'front page scandals', 'the most liked creator', 'gets raw',
  'what you don’t see', 'what you dont see', 'average dicks', 'hooking up with fans',
  'asked chatgpt', 'biggest mistake ever', 'unmasked', 'confessions',
  'behind her persona', 'in real life', 'q&a', 'myth rewritten',
  'cosplayground', 'documentary', 'front page scandals', 'roast my',
  'bang surprise', 'exposes her dirtiest', 'dirtiest on-set',
  'life, death &', 'breaking free', 'journey to', 'filmmaker',
  'adult content creator', 'the new wave of', 'penis size is fine',
  'disagree with the ads', 'how elsa jean became'
];

function parseDurationSec(d) {
  if (!d) return 0;
  if (typeof d === 'number') return d;
  const s = String(d).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) return parts[0] * 60 + parts[1];
  const minMatch = s.match(/(\d+)\s*(?:min|m\b)/i);
  const secMatch = s.match(/(\d+)\s*(?:sec|s\b)/i);
  let total = 0;
  if (minMatch) total += parseInt(minMatch[1], 10) * 60;
  if (secMatch) total += parseInt(secMatch[1], 10);
  return total;
}

function isAdultContent(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  if (/^ep\s*\d+/i.test(t)) return false;
  if (/\b(podcast|unboxing|interview|mukbang|vlog|talk show|radio show|filmmaker|documentary)\b/i.test(t)) return false;
  return !BAN_WORDS.some((w) => t.includes(w));
}

function parseCards($, scope) {
  const seen = new Set();
  const out = [];

  // Remove duplicate navigation menus, dropdown lists and promoted ad banners that Pornhub repeats on every page
  if ($) {
    try {
      $(
        '#hottestMenuSection, #recommMenuSection, .dropdownHottestVideos, ' +
        '.dropdownReccomendedVideos, .premiumStyle, .featuredVideoBlock, ' +
        'header, #header, #headerMenu, footer, #footer, .subHeaderWrapper, ' +
        '.promotedVideos, .relPopVideos'
      ).remove();
    } catch {}
  }

  // Target actual main video list container if present, else fallback
  const mainScope = scope || (
    $('#videoSearchResult').length ? $('#videoSearchResult') :
    ($('#videoCategory').length ? $('#videoCategory') :
    ($('ul.search-video-thumbs').length ? $('ul.search-video-thumbs') :
    ($('ul.videos').length ? $('ul.videos').first() :
    ($('ul.nf-videos').length ? $('ul.nf-videos') : null))))
  );

  const root = mainScope ? $(mainScope) : $.root();
  root.find('li.videoblock, li.pcVideoListItem').each((_, li) => {
    const $li = $(li);
    const vkey = $li.attr('data-video-vkey') || null;
    const $a = $li.find('a[href*="view_video.php"]').first();
    const href = $a.attr('href');
    if (!href) return;
    const url = absUrl(href.split('&')[0].includes('viewkey') ? href : href);
    const key = vkey || url;
    if (seen.has(key)) return;
    seen.add(key);

    let title = ($a.attr('title') || $li.find('.title a, .title').first().text() || '').trim().replace(/\s+/g, ' ');
    title = title.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '').replace(/\s+/g, ' ').trim();
    if (!title || !isAdultContent(title)) return;

    const duration = $li.find('.duration').first().text().trim().replace(/\s+/g, ' ');
    if (duration && parseDurationSec(duration) < 600) return; // Skip videos under 10 minutes!

    const $img = $li.find('img').first();
    let thumb = $img.attr('data-mediumthumb') || $img.attr('data-thumb_url') || $img.attr('data-src') || $img.attr('src') || null;
    if (thumb && thumb.startsWith('//')) thumb = 'https:' + thumb;
    if (thumb && thumb.includes('data:image')) thumb = null;
    if (!thumb || !thumb.startsWith('http')) {
      thumb = getPermanentFallbackThumbnail(title, vkey || url);
    }

    const views = $li.find('.views').first().text().trim().replace(/\s+/g, ' ');
    let added = $li.find('.added').first().text().trim().replace(/\s+/g, ' ');
    if (!added || /\b(5[0-9]|[6-9]\d|\d{3,})\s*years?\s*ago\b/i.test(added) || /1970/i.test(added)) {
      const days = ((title.length * 7 + (vkey || '').charCodeAt(0)) % 14) + 1;
      added = days === 1 ? '1 day ago' : (days < 7 ? `${days} days ago` : `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`);
    }
    const html = $li.html() || '';
    const hd = /hd-text|is-hd/i.test(html);
    const premium = /premiumIcon|is-premium/i.test(html);
    const author = $li.find('.usernameLink, .videoUploader a').first().text().trim().replace(/\s+/g, ' ') || null;
    let preview = $img.attr('data-mediabook') || $li.attr('data-mediabook') || $img.attr('data-preview') || $li.attr('data-preview') || null;
    if (preview && preview.startsWith('//')) preview = 'https:' + preview;

    out.push({ vkey, title, url, thumbnail: thumb, duration: duration || null, views: views || null, added, hd, premium, author, preview: preview || null });
  });
  return out;
}

/* ---------------- feeds ---------------- */
const FEEDS = {
  home: (p) => `${BASE}/video?o=cm&page=${p || 1}`, // Scrape Newest / Most Recent daily uploads!
  hottest: (p) => `${BASE}/video?o=ht&page=${p || 1}`,
  most_viewed: (p) => `${BASE}/video?o=mv&page=${p || 1}`,
  top_rated: (p) => `${BASE}/video?o=tr&page=${p || 1}`,
  newest: (p) => `${BASE}/video?o=cm&page=${p || 1}`,
};

/* Pool all unique fallback video cards across all snapshot HTML files and persistent auto-synced cache */
const AUTO_VIDEOS_FILE = path.join(process.cwd(), 'auto_videos.json');
const TMP_VIDEOS_FILE = path.join(os.tmpdir(), 'auto_videos.json');

function saveAutoVideos(cards) {
  if (!cards || !cards.length) return;
  try {
    let existing = [];
    if (fs.existsSync(AUTO_VIDEOS_FILE)) {
      try { existing = JSON.parse(fs.readFileSync(AUTO_VIDEOS_FILE, 'utf8')); } catch {}
    } else if (fs.existsSync(TMP_VIDEOS_FILE)) {
      try { existing = JSON.parse(fs.readFileSync(TMP_VIDEOS_FILE, 'utf8')); } catch {}
    }
    const seen = new Set(existing.map((v) => v.vkey || v.url));
    let addedCount = 0;
    for (const c of cards) {
      const key = c.vkey || c.url;
      if (!key || seen.has(key)) continue;
      if (parseDurationSec(c.duration) < 600) continue; // Skip videos under 10 minutes!
      seen.add(key);
      existing.unshift(c);
      addedCount++;
    }
    if (addedCount > 0) {
      const trimmed = existing.slice(0, 65000);
      try { fs.writeFileSync(AUTO_VIDEOS_FILE, JSON.stringify(trimmed), 'utf8'); } catch {}
      try { fs.writeFileSync(TMP_VIDEOS_FILE, JSON.stringify(trimmed), 'utf8'); } catch {}
    }
  } catch {}
}

let _allFallbackVideos = null;
function getFallbackVideos() {
  if (_allFallbackVideos && _allFallbackVideos.length > 0) return _allFallbackVideos;
  const root = process.cwd();
  const seen = new Set();
  const list = [];

  // 1. Load auto-synced newly added 52,000+ videos catalog
  try {
    let autoList = [];
    if (fs.existsSync(AUTO_VIDEOS_FILE)) {
      autoList = JSON.parse(fs.readFileSync(AUTO_VIDEOS_FILE, 'utf8'));
    } else if (fs.existsSync(TMP_VIDEOS_FILE)) {
      autoList = JSON.parse(fs.readFileSync(TMP_VIDEOS_FILE, 'utf8'));
    }
    if (!autoList || !autoList.length) {
      try { autoList = require('../auto_videos.json'); } catch {}
    }
    if (!autoList || !autoList.length) {
      autoList = SEED_VIDEOS || [];
    }
    if (Array.isArray(autoList)) {
      for (const v of autoList) {
        const key = v.vkey || v.url;
        if (!key || seen.has(key)) continue;
        if (parseDurationSec(v.duration) < 600) continue; // Skip videos under 10 minutes!
        seen.add(key);
        // Normalize upload date so no video has stale dates (years/months ago)
        let added = v.added;
        if (!added || /months?\s*ago|years?\s*ago|1970/i.test(added)) {
          let h = 0;
          for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
          const days = (h % 14) + 1;
          added = days === 1 ? 'Yesterday' : (days < 7 ? `${days} days ago` : (days < 14 ? '1 week ago' : '2 weeks ago'));
        }
        let thumbnail = v.thumbnail;
        if (!thumbnail || !thumbnail.startsWith('http') || thumbnail.includes('pix-')) {
          thumbnail = getPermanentFallbackThumbnail(v.title, key);
        }
        list.push({ ...v, added, thumbnail });
      }
    }
  } catch {}

  // 2. Add SEED_VIDEOS if any missed
  for (const v of SEED_VIDEOS) {
    const key = v.vkey || v.url;
    if (!key || seen.has(key)) continue;
    if (parseDurationSec(v.duration) < 600) continue; // Skip videos under 10 minutes!
    seen.add(key);
    let added = v.added;
    if (!added || /months?\s*ago|years?\s*ago|1970/i.test(added)) {
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      const days = (h % 14) + 1;
      added = days === 1 ? 'Yesterday' : (days < 7 ? `${days} days ago` : (days < 14 ? '1 week ago' : '2 weeks ago'));
    }
    let thumbnail = v.thumbnail;
    if (!thumbnail || !thumbnail.startsWith('http') || thumbnail.includes('pix-')) {
      thumbnail = getPermanentFallbackThumbnail(v.title, key);
    }
    list.push({ ...v, added, thumbnail });
  }

  _allFallbackVideos = list;
  return list;
}

function registerNewVideos(cards) {
  if (!cards || !Array.isArray(cards) || cards.length === 0) return 0;
  const pool = getFallbackVideos();
  const seen = new Set(pool.map((v) => v.vkey || v.url));
  const newAdultCards = [];
  for (const c of cards) {
    const key = c.vkey || c.url;
    if (!key || seen.has(key)) continue;
    if (!isAdultContent(c.title)) continue;
    seen.add(key);
    pool.unshift(c); // Put new video at the front so it appears first in feed
    newAdultCards.push(c);
  }
  if (newAdultCards.length > 0) {
    console.log(`[scraper] Automatically added ${newAdultCards.length} new adult videos to catalog! Total: ${pool.length}`);
    saveAutoVideos(newAdultCards);
  }
  return newAdultCards.length;
}

async function autoSyncNewVideos() {
  console.log('[scraper] Running dynamic autoSyncNewVideos...');
  const poolOfTargets = [
    `${BASE}/video?o=cm&page=1`, // Newest uploads page 1
    `${BASE}/video?o=cm&page=2`, // Newest uploads page 2
    `${BASE}/video?o=ht&page=1`, // Hottest trending
    `${BASE}/video?o=mv&page=1`, // Most viewed
    `${BASE}/video?c=101&page=1`, // Indian / Desi
    `${BASE}/video?c=101&page=2`,
    `${BASE}/video/search?search=bhabhi&page=1`,
    `${BASE}/video/search?search=desi&page=1`,
    `${BASE}/video?c=13&page=1`,  // Teen 18+
    `${BASE}/video?c=13&page=2`,
    `${BASE}/video?c=3&page=1`,   // Anal
    `${BASE}/video?c=3&page=2`,
    `${BASE}/video?c=14&page=1`,  // MILF
    `${BASE}/video?c=8&page=1`,   // Big Tits
    `${BASE}/video?c=7&page=1`,   // Big Ass
    `${BASE}/video?c=93&page=1`,  // Russian / European
    `${BASE}/video?c=25&page=1`,  // Latina
    `${BASE}/video?c=19&page=1`,  // Ebony
    `${BASE}/video?c=1&page=1`,   // Asian
    `${BASE}/video?c=111&page=1`, // Japanese JAV
    `${BASE}/video?c=27&page=1`,  // Lesbian
    `${BASE}/video?c=21&page=1`,  // Hardcore
    `${BASE}/video?c=67&page=1`,  // Rough
    `${BASE}/video?c=65&page=1`,  // Threesome
    `${BASE}/video?c=15&page=1`,  // Creampie
    `${BASE}/video?c=69&page=1`,  // Squirt
    `${BASE}/video?c=138&page=1`, // Verified Amateurs
  ];

  // Pick 8 targets dynamically: always 2 newest uploads + 6 rotating categories
  const newestTargets = poolOfTargets.slice(0, 2);
  const remaining = poolOfTargets.slice(2);
  const shuffled = remaining.sort(() => 0.5 - Math.random());
  const selectedTargets = [...newestTargets, ...shuffled.slice(0, 6)];

  let totalNew = 0;
  for (const url of selectedTargets) {
    try {
      const html = await fetchHtml(url);
      if (html && html.length > 20000) {
        const $ = cheerio.load(html);
        const cards = parseCards($);
        const count = registerNewVideos(cards);
        totalNew += count;
      }
    } catch (e) {
      console.error('[scraper] autoSync failed for ' + url + ':', e.message);
    }
  }

  const pool = getFallbackVideos();
  return {
    success: true,
    newlyAdded: totalNew,
    totalCatalogSize: pool.length,
    timestamp: new Date().toISOString(),
  };
}

/* Deterministic daily seed so the video pool automatically rotates fresh videos every single day */
function getDailySeed(prefix = '') {
  // Use Indian Standard Time (UTC+5:30) date YYYY-MM-DD
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const dateStr = now.toISOString().slice(0, 10);
  return `${prefix}:${dateStr}`;
}

/* Deterministic seeded random generator */
function seededRandom(seedStr) {
  let s = 0;
  const str = String(seedStr || 'ph');
  for (let i = 0; i < str.length; i++) {
    s = (s * 31 + str.charCodeAt(i)) >>> 0;
  }
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* Get a deterministically shuffled pool for a given feed/category that rotates every 24 hours */
function getShuffledPool(seedKey) {
  const pool = [...getFallbackVideos()];
  const dailyKey = getDailySeed(seedKey);
  const rng = seededRandom(dailyKey);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/**
 * STRICT NON-OVERLAPPING PAGINATION:
 * Page 1 gets [0 .. pageSize-1]
 * Page 2 gets [pageSize .. 2*pageSize-1]
 * Page 3 gets [2*pageSize .. 3*pageSize-1]
 * GUARANTEED: Page 1 and Page 2 share 0 videos.
 * Page 2 and Page 3 share 0 videos.
 */
function paginatePool(sourcePool, page = 1, pageSize = 24) {
  if (!sourcePool || sourcePool.length === 0) return [];
  const N = sourcePool.length;
  const p = Math.max(1, parseInt(page) || 1);
  const start = (p - 1) * pageSize;

  const slice = [];
  for (let i = 0; i < pageSize; i++) {
    const idx = (start + i) % N;
    slice.push(sourcePool[idx]);
  }
  return slice;
}

async function feed(type = 'home', page = 1, mix = '0') {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const feedKey = `${type}:v35:${pageNum}`;
  const dailyKey = getDailySeed(`${type}:${mix}`);
  const key = `feed-v35:${dailyKey}:${pageNum}`;

  // 1. Check L1 in-memory cache
  const l1 = getCache(key);
  if (l1) return l1;

  // 2. Check L2 Postgres DB cache
  try {
    const l2 = await getFeedCache(feedKey);
    if (l2) {
      setCache(key, l2, 5 * 60 * 1000);
      return l2;
    }
  } catch (err) {
    console.warn(`[scraper] Feed L2 read error:`, err.message);
  }

  // 3. Try LIVE scrape first for section-accurate content.
  // This ensures Hottest shows actually-hot videos, Newest shows actually-new, etc.
  // Falls back to catalog pool if live scrape fails.
  if (FEEDS[type]) {
    try {
      const liveUrl = FEEDS[type](pageNum);
      const html = await fetchHtml(liveUrl);
      if (html && html.length > 20000) {
        const $ = cheerio.load(html);
        const cards = parseCards($);
        const liveVideos = cards
          .filter((v) => v && v.vkey && v.title)
          .filter((v) => isAdultContent(v.title))
          .filter((v) => parseDurationSec(v.duration) >= 600)
          .slice(0, 24);
        if (liveVideos.length >= 8) {
          const result = { type, page: pageNum, videos: liveVideos, totalCount: liveVideos.length, live: true };
          setCache(key, result, 5 * 60 * 1000);
          try {
            await setFeedCache(feedKey, result, 5 * 60);
          } catch {}
          console.log(`[scraper] Live feed success for ${type} page ${pageNum}: ${liveVideos.length} videos`);
          return result;
        }
      }
    } catch (err) {
      console.warn(`[scraper] Live feed failed for ${type}, falling back to pool:`, err.message);
    }
  }

  // 4. Compute feed from catalog / upstream (fallback)
  const pool = getFallbackVideos();
  const pageSize = 24;

  // Prioritize pool ordering by feed type
  let targetPool;
  if (type === 'newest') {
    // Latest uploads from catalog (newest videos first)
    targetPool = pool;
  } else if (type === 'hottest') {
    // Hottest: Feature the freshest new videos with daily deterministic rotation
    const freshPool = pool.slice(0, 10000);
    const dKey = getDailySeed(`hottest:${mix}`);
    const rng = seededRandom(dKey);
    const shuffledFresh = [...freshPool];
    for (let i = Math.min(shuffledFresh.length - 1, 2000); i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledFresh[i], shuffledFresh[j]] = [shuffledFresh[j], shuffledFresh[i]];
    }
    targetPool = [...shuffledFresh, ...pool.slice(10000)];
  } else if (type === 'home') {
    // Home feed: fresh daily variety from top recent catalog
    const freshPool = pool.slice(0, 10000);
    const dKey = getDailySeed(`home:${mix}`);
    const rng = seededRandom(dKey);
    const shuffledFresh = [...freshPool];
    for (let i = Math.min(shuffledFresh.length - 1, 2000); i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledFresh[i], shuffledFresh[j]] = [shuffledFresh[j], shuffledFresh[i]];
    }
    targetPool = [...shuffledFresh, ...pool.slice(10000)];
  } else if (type === 'most_viewed') {
    targetPool = [...pool].sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0));
  } else if (type === 'top_rated') {
    targetPool = [...pool].sort((a, b) => (b.percent || 0) - (a.percent || 0));
  } else {
    targetPool = pool;
  }

  // Paginate strictly non-overlapping
  const pagedVideos = paginatePool(targetPool, pageNum, pageSize);

  // Filter to ensure 100% adult content and no shorts (< 180s)
  const videos = pagedVideos
    .filter((v) => isAdultContent(v.title))
    .filter((v) => parseDurationSec(v.duration) >= 600)
    .map((v) => {
      let added = v.added;
      if (!added || /months?\s*ago|years?\s*ago|1970/i.test(added)) {
        let h = 0;
        const k = v.vkey || v.title || '';
        for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
        const days = (h % 14) + 1;
        added = days === 1 ? 'Yesterday' : (days < 7 ? `${days} days ago` : (days < 14 ? '1 week ago' : '2 weeks ago'));
      }
      return { ...v, added };
    });

  const result = { type, page: pageNum, videos, totalCount: targetPool.length };

  // 4. Populate L1 and L2 (expiresAt = now + 5 minutes)
  setCache(key, result, 5 * 60 * 1000);
  try {
    await setFeedCache(feedKey, result, 5 * 60);
  } catch (err) {
    console.warn(`[scraper] Feed L2 write error:`, err.message);
  }

  return result;
}

const SEARCH_SORT = { relevant: 'mr', viewed: 'mv', rated: 'tr', longest: 'lg', newest: 'cm' };
async function searchVideos(q, page = 1, sort = 'relevant') {
  const o = SEARCH_SORT[sort] || 'mr';
  const cleanQ = (q || '').trim();
  const key = `search-v32:${cleanQ}:${page}:${sort}`;
  return cached(key, 8 * 60 * 1000, async () => {
    let videos = [];
    let totalText = null;

    try {
      const url = `${BASE}/video/search?search=${encodeURIComponent(cleanQ)}&page=${page}&o=${o}`;
      const html = await fetchHtml(url);
      if (html && html.length > 20000 && !html.includes('Page Not Found')) {
        const $ = cheerio.load(html);

        // Remove navigation menus and dropdowns that contain unrelated 2-item preview cards
        $(
          '#hottestMenuSection, #recommMenuSection, .dropdownHottestVideos, ' +
          '.dropdownReccomendedVideos, .premiumStyle, .featuredVideoBlock, ' +
          'header, #header, #headerMenu, footer, #footer, .subHeaderWrapper, ' +
          '.promotedVideos, .relPopVideos'
        ).remove();

        const searchScope = $('#videoSearchResult').length
          ? $('#videoSearchResult')
          : ($('ul.search-video-thumbs').length
          ? $('ul.search-video-thumbs')
          : ($('ul.videos').length ? $('ul.videos').first() : null));

        const candidateVideos = parseCards($, searchScope && searchScope.length ? searchScope : null);
        if (candidateVideos && candidateVideos.length > 0) {
          // Relevance guard: if the parsed videos don't actually match the query,
          // we're probably scraping a sidebar/recommended block (same on every
          // page) — discard and fall back to the catalog.
          const qWords = cleanQ.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
          if (qWords.length > 0) {
            const relevant = candidateVideos.filter((v) => {
              const t = (v.title || '').toLowerCase();
              return qWords.some((w) => t.includes(w));
            });
            // If less than 25% match, it's not real search results
            if (relevant.length < candidateVideos.length * 0.25) {
              videos = [];
            } else {
              registerNewVideos(candidateVideos);
              videos = candidateVideos;
              totalText = $('.showingCounter, .resultsCount').first().text().trim() || null;
            }
          } else {
            registerNewVideos(candidateVideos);
            videos = candidateVideos;
            totalText = $('.showingCounter, .resultsCount').first().text().trim() || null;
          }
        }
      }
    } catch {
      videos = [];
    }

    // GUARANTEE MINIMUM 24 VIDEOS PER SEARCH PAGE
    // If upstream returned empty OR fewer than 24 videos, pad or generate from catalog!
    if (!videos || videos.length < 24) {
      const pool = getFallbackVideos();
      const rawQ = cleanQ.toLowerCase();
      const words = rawQ.split(/\s+/).filter((w) => w.length > 0);

      if (words.length > 0) {
        // Comprehensive Adult Synonyms & Word Pairings
        const synMap = {
          bhabhi: ['bhabhi', 'desi', 'indian', 'saree', 'aunty', 'hindi', 'village', 'devar', 'mallu', 'pakistani'],
          desi: ['desi', 'bhabhi', 'indian', 'saree', 'aunty', 'hindi', 'pakistani', 'village', 'mallu'],
          indian: ['indian', 'desi', 'bhabhi', 'saree', 'aunty', 'hindi', 'pakistani', 'village'],
          hindi: ['hindi', 'desi', 'bhabhi', 'indian', 'saree', 'aunty'],
          aunty: ['aunty', 'bhabhi', 'desi', 'indian', 'mature', 'milf', 'saree'],
          saree: ['saree', 'bhabhi', 'desi', 'indian'],
          devar: ['devar', 'bhabhi', 'desi', 'indian'],
          mallu: ['mallu', 'desi', 'indian', 'bhabhi', 'aunty'],
          pakistani: ['pakistani', 'desi', 'bhabhi', 'indian'],

          stepmom: ['stepmom', 'step mom', 'mom', 'mother', 'milf', 'mature', 'stepson'],
          'step mom': ['stepmom', 'step mom', 'mom', 'milf'],
          stepsister: ['stepsister', 'step sister', 'sister', 'stepbro', 'teen'],
          'step sister': ['stepsister', 'step sister', 'sister', 'teen'],
          stepbro: ['stepbro', 'step brother', 'brother', 'sister'],
          stepdad: ['stepdad', 'step dad', 'dad', 'daughter'],
          milf: ['milf', 'mom', 'stepmom', 'mature', 'mother', 'wife', 'cougar', 'housewife'],
          mature: ['mature', 'milf', 'mom', 'stepmom', 'cougar', 'older'],

          teen: ['teen', '18', 'college', 'school', 'petite', 'young', 'coed', 'dorm', 'innocent', 'student'],
          '18': ['18', 'teen', 'college', 'young', 'petite'],
          college: ['college', 'dorm', 'teen', 'sorority', 'coed', 'student'],
          petite: ['petite', 'skinny', 'small', 'teen', 'tiny'],

          anal: ['anal', 'ass', 'butt', 'doggystyle', 'backdoor', 'gap', 'dp', 'tight ass'],
          creampie: ['creampie', 'cream pie', 'cream', 'cum inside', 'breeding', 'internal', 'load'],
          cum: ['cum', 'creampie', 'facial', 'swallow', 'ejaculation', 'squirt', 'load'],
          blowjob: ['blowjob', 'blow job', 'bj', 'suck', 'throat', 'deepthroat', 'oral', 'swallow'],
          deepthroat: ['deepthroat', 'deep throat', 'blowjob', 'throat', 'gag'],
          handjob: ['handjob', 'hand job', 'hj', 'stroke'],
          threesome: ['threesome', 'three', 'trio', '3some', 'ffm', 'mmf', 'group'],
          gangbang: ['gangbang', 'gang bang', 'group', 'dp', 'double penetration', 'orgy', 'sluts'],

          squirt: ['squirt', 'squirting', 'gush', 'fountain', 'wet', 'orgasm'],
          rough: ['rough', 'hardcore', 'hard', 'choke', 'slap', 'intense', 'pound', 'destroy'],
          hardcore: ['hardcore', 'rough', 'pounded', 'intense', 'deep', 'hard'],

          russian: ['russian', 'euro', 'czech', 'blonde', 'european', 'model'],
          latina: ['latina', 'spanish', 'mexican', 'colombian', 'brazilian', 'culona', 'big ass'],
          ebony: ['ebony', 'black', 'bbc', 'dark', 'thick'],
          asian: ['asian', 'japanese', 'korean', 'chinese', 'jav', 'uncensored', 'oriental'],
          japanese: ['japanese', 'jav', 'asian', 'tokyo', 'chikan', 'uncensored'],
          korean: ['korean', 'asian', 'seoul', 'webcam'],

          lesbian: ['lesbian', 'girl on girl', 'pussy licking', 'scissoring', 'strapon', 'girls'],
          massage: ['massage', 'masseuse', 'sensual', 'oil', 'spa', 'nuru', 'rub'],
          pov: ['pov', 'first person', 'gopro'],
          public: ['public', 'outdoor', 'beach', 'car', 'parking', 'caught', 'risky'],
          amateur: ['amateur', 'homemade', 'real', 'couple', 'bedroom', 'verified'],
          boobs: ['boobs', 'tits', 'busty', 'big tits', 'huge boobs', 'bbw'],
          tits: ['tits', 'boobs', 'busty', 'big tits', 'huge boobs'],
          ass: ['ass', 'butt', 'booty', 'anal', 'doggystyle', 'thick'],
        };

        const scored = pool.map((v) => {
          const title = (v.title || '').toLowerCase();
          const author = (v.author || '').toLowerCase();
          let score = 0;

          // Exact full query match
          if (title.includes(rawQ)) score += 160;
          if (author.includes(rawQ)) score += 90;

          // Word matching
          let wordMatches = 0;
          for (const w of words) {
            if (title.includes(w)) {
              score += 35;
              wordMatches++;
            }
            if (author.includes(w)) {
              score += 40;
              wordMatches++;
            }
          }
          if (wordMatches === words.length && words.length > 1) {
            score += 70; // All search words matched!
          }

          // Synonyms matching
          for (const [k, syns] of Object.entries(synMap)) {
            if (rawQ.includes(k) || words.includes(k)) {
              for (const syn of syns) {
                if (title.includes(syn)) score += 25;
              }
            }
          }

          return { ...v, score };
        });

        let matched = scored
          .filter((v) => v.score > 0)
          // Higher score first; on tie, more-viewed video wins
          .sort((a, b) => (b.score - a.score) || ((parseCompact(b.views) || 0) - (parseCompact(a.views) || 0)));

        // NOTE: No random padding here — only genuinely matching videos are returned.
        // Showing fewer relevant results beats showing 24 irrelevant ones.

        // Sort by requested filter
        if (sort === 'viewed') {
          matched.sort((a, b) => (parseCompact(b.views) || 0) - (parseCompact(a.views) || 0));
        } else if (sort === 'longest') {
          const toSec = (d) => {
            const parts = (d || '').split(':').map(Number);
            return parts.length === 2 ? parts[0] * 60 + parts[1] : (parts[0] * 3600 + parts[1] * 60 + parts[2] || 0);
          };
          matched.sort((a, b) => toSec(b.duration) - toSec(a.duration));
        }

        const pageSize = 24;
        const p = Math.max(1, parseInt(page) || 1);

        if (videos && videos.length > 0) {
          // If we have some upstream videos (e.g. 2 to 23), pad up to 24 with catalog videos!
          // Padding is page-aware: offset into the catalog matches by page so
          // page 2/3 don't repeat page 1's padding.
          const existingKeys = new Set(videos.map((v) => v.vkey || v.url).filter(Boolean));
          const extra = matched.filter((m) => !existingKeys.has(m.vkey || m.url));
          const needed = pageSize - videos.length;
          const offset = (p - 1) * pageSize;
          videos = [...videos, ...extra.slice(offset, offset + needed)];
          // Deduplicate by vkey (upstream itself can repeat a video)
          const seen = new Set();
          videos = videos.filter((v) => {
            const k = v.vkey || v.url;
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          if (!totalText) {
            totalText = `${matched.length} videos found for "${cleanQ}"`;
          }
        } else {
          const start = (p - 1) * pageSize;
          videos = matched.slice(start, start + pageSize);
          totalText = `${matched.length} videos found for "${cleanQ}"`;
        }
      } else {
        const source = getShuffledPool(`search:${sort}`);
        videos = paginatePool(source, page, 24);
        totalText = `${source.length}+ videos found`;
      }
    }

    return { q: cleanQ, page, sort, videos, totalText };
  });
}

/* ---------------- categories ---------------- */
async function categories() {
  return cached('categories', 60 * 60 * 1000, () => withRetry(async () => {
    const html = await fetchHtml(`${BASE}/categories`);
    const $ = cheerio.load(html);
    let out = [];
    const seen = new Set();
    $('li.catPic').each((_, el) => {
      const $el = $(el);
      const $titleA = $el.find('.categoryTitleWrapper a').first();
      const href = $titleA.attr('href');
      if (!href || seen.has(href)) return;
      seen.add(href);
      const name = ($titleA.find('strong').text() || $titleA.text() || '').trim().replace(/\s+/g, ' ');
      const $img = $el.find('.relativeWrapper a img').first();
      let thumb = $img.attr('src') || $img.attr('data-src') || null;
      if (thumb && thumb.startsWith('//')) thumb = 'https:' + thumb;
      let count = ($el.find('.videoCount').text() || '').trim().replace(/\s+/g, ' ') || null;
      if (count) {
        count = count.replace(/\b(\d{1,3})\.(\d{3})\b/g, '$1,$2').replace(/\b(\d{4,})\b/g, (m) => parseInt(m, 10).toLocaleString('en-US'));
      }
      if (!name) return;
      out.push({ name, url: absUrl(href), slug: href, thumbnail: thumb, count });
    });
    if (!out.length) {
      out = CATEGORIES.map(c => ({ ...c, url: absUrl(c.slug) }));
    }
    return out;
  }, 2, 'categories'));
}

/* Warm up the session in the background so it never blocks page load */
let _warmed = false;
async function warmup() {
  if (_warmed) return;
  _warmed = true;
  fetchHtml(`${BASE}/`, 1).catch(() => {});
}

async function categoryVideos(slug, page = 1) {
  const key = `cat-v5:${slug}:${page}`;
  return cached(key, 8 * 60 * 1000, async () => {
    let videos = [];
    let title = '';
    try {
      const url = absUrl(slug) + (slug.includes('?') ? '&' : '?') + `page=${page}`;
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      title = ($('h1').first().text() || '').trim().replace(/\s+/g, ' ');
      videos = parseCards($);
      registerNewVideos(videos);
    } catch {
      videos = [];
    }

    if (!title || title === 'Category') {
      const clean = slug.replace(/.*\/video\?c=|\/categories\/?/g, '').replace(/[-_]/g, ' ');
      title = clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Category Videos';
    }

    let adultVideos = (videos || []).filter((v) => isAdultContent(v.title) && parseDurationSec(v.duration) >= 600);

    // Deduplicate against page 1 if page > 1
    if (page > 1) {
      try {
        const p1 = await categoryVideos(slug, 1);
        if (p1 && p1.videos) {
          const p1Keys = new Set(p1.videos.map((v) => v.vkey || v.url).filter(Boolean));
          adultVideos = adultVideos.filter((v) => !p1Keys.has(v.vkey || v.url));
        }
      } catch {}
    }

    if (!adultVideos.length || adultVideos.length < 10) {
      // Fallback: only genuinely matching catalog videos — never random filler.
      const pool = getFallbackVideos();
      const cleanWord = title.toLowerCase().split(' ')[0];
      const matched = pool.filter((v) => (v.title || '').toLowerCase().includes(cleanWord) && parseDurationSec(v.duration) >= 600);
      videos = paginatePool(matched, page, 24);
    } else {
      videos = adultVideos.filter((v) => parseDurationSec(v.duration) >= 600);
    }

    return { slug, page, title, videos };
  });
}

function extractPornstarAvatar($, starName, slug) {
  if (!$) return null;
  const normName = (starName || '').toLowerCase().trim();
  const normSlug = (slug || '').toLowerCase().replace(/[-_]/g, ' ').trim();

  // 1. Direct ID getAvatar
  const getAvatar = $('img#getAvatar, #getAvatar img').first();
  const getAvatarSrc = getAvatar.attr('src') || getAvatar.attr('data-src');
  if (getAvatarSrc && getAvatarSrc.includes('phncdn.com') && !getAvatarSrc.includes('/videos/')) {
    return getAvatarSrc;
  }

  // 2. Direct ID or class getBioImage / thumbImage / actorBioAvatar / userAvatar
  const bio = $('#getBioImage, #getBioImage img, img.thumbImage, .thumbImage img, .actorBioAvatar img, .userAvatar img').first();
  const bioSrc = bio.attr('src') || bio.attr('data-src') || bio.attr('data-thumb');
  if (bioSrc && bioSrc.includes('phncdn.com') && !bioSrc.includes('/videos/')) {
    return bioSrc;
  }

  // 3. Image with alt matching star name and src in /pics/pornstars/ or /pics/users/ or avatar
  let matchedSrc = null;
  $('img').each((_, el) => {
    if (matchedSrc) return;
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-thumb') || '';
    const alt = ($(el).attr('alt') || '').toLowerCase().trim();
    if (!src.includes('phncdn.com') || src.includes('/videos/')) return;

    const isPics = src.includes('/pics/pornstars/') || src.includes('/pics/users/') || src.includes('avatar');
    const isNameMatch = (normName && alt === normName) || (normSlug && alt === normSlug) || (normName && alt.includes(normName));

    if (isPics && isNameMatch) {
      matchedSrc = src;
    }
  });
  if (matchedSrc) return matchedSrc;

  // 4. Any image with /pics/pornstars/
  $('img').each((_, el) => {
    if (matchedSrc) return;
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src.includes('/pics/pornstars/') && !src.includes('/videos/')) {
      matchedSrc = src;
    }
  });
  if (matchedSrc) return matchedSrc;

  // 5. og:image if not a video thumbnail
  const og = $('meta[property="og:image"]').attr('content');
  if (og && og.includes('phncdn.com') && !og.includes('/videos/') && (og.includes('avatar') || og.includes('/pics/'))) {
    return og;
  }

  return null;
}

async function pornstarVideos(slug, page = 1) {
  const cleanSlug = String(slug || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const key = `pornstar-v1:${cleanSlug}:${page}`;
  return cached(key, 5 * 60 * 1000, async () => {
    let videos = [];
    let name = '';
    let avatar = null;
    let totalPages = 1;

    // Check DB L2 Cache for resolved real avatar (7-day cache)
    try {
      const dbCached = await getFeedCache(`pornstar_avatar:${cleanSlug}`);
      if (dbCached && dbCached.avatar) {
        avatar = dbCached.avatar;
        if (dbCached.name && !name) name = dbCached.name;
      }
    } catch {}

    try {
      const fullUrl = `${BASE}/pornstar/${cleanSlug}/videos?page=${page}`;
      const html = await fetchHtml(fullUrl);
      const $ = cheerio.load(html);
      name = ($('h1').first().text() || '').trim().replace(/\s+/g, ' ');
      if (!name) {
        name = cleanSlug.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      }

      if (!avatar) {
        avatar = extractPornstarAvatar($, name, cleanSlug);
      }

      videos = parseCards($);
      registerNewVideos(videos);

      $('.page_number, .pagination li, .pageNumber, a[href*="page="]').each((_, el) => {
        const num = parseInt($(el).text().trim(), 10);
        if (!isNaN(num) && num > totalPages) totalPages = num;
      });
      if (totalPages === 1 && videos.length >= 20) totalPages = page + 1;
    } catch (e) {
      console.warn('[scraper] pornstarVideos error:', e.message);
    }

    // If still no real avatar, fetch the pornstar profile/bio header
    if (!avatar) {
      try {
        const bioHtml = await fetchHtml(`${BASE}/pornstar/${cleanSlug}`);
        const $bio = cheerio.load(bioHtml);
        const bioAvatar = extractPornstarAvatar($bio, name, cleanSlug);
        if (bioAvatar) {
          avatar = bioAvatar;
        }
      } catch (err) {
        console.warn(`[scraper] pornstar bio header fetch failed for ${cleanSlug}:`, err.message);
      }
    }

    // If still no real avatar, search the pornstars directory (e.g. Mia Khalifa, classic stars)
    if (!avatar) {
      try {
        const query = name || cleanSlug.replace(/[-_]/g, ' ');
        const searchHtml = await fetchHtml(`${BASE}/pornstars/search?search=${encodeURIComponent(query)}`);
        const $search = cheerio.load(searchHtml);
        $search('ul#pornstarsSearchResult li, .pornstarSection li, ul.gridWrapper li').each((_, el) => {
          if (avatar) return;
          const href = ($search(el).find('a').first().attr('href') || '').toLowerCase();
          if (href.includes(`/pornstar/${cleanSlug}`)) {
            const img = $search(el).find('img').first();
            const src = img.attr('src') || img.attr('data-src') || img.attr('data-thumb_url') || img.attr('data-mediumthumb');
            if (src && !src.includes('default') && !src.includes('/videos/')) {
              avatar = src;
            }
          }
        });
      } catch (err) {
        console.warn(`[scraper] pornstar directory search failed for ${cleanSlug}:`, err.message);
      }
    }

    // If real avatar found, persist to DB cache with 7-day TTL
    if (avatar) {
      setFeedCache(`pornstar_avatar:${cleanSlug}`, { avatar, name }, 7 * 24 * 3600).catch(() => {});
    }

    let finalVideos = (videos || []).filter((v) => parseDurationSec(v.duration) >= 600);

    if (!finalVideos.length) {
      const pool = getFallbackVideos();
      const cleanWord = cleanSlug.replace(/[-_]/g, ' ');
      const matched = pool.filter((v) => ((v.title || '').toLowerCase().includes(cleanWord) || (v.author || '').toLowerCase().includes(cleanWord)) && parseDurationSec(v.duration) >= 600);
      const source = (matched.length >= 6 ? matched : getShuffledPool(`ps:${cleanSlug}`)).filter((v) => parseDurationSec(v.duration) >= 600);
      finalVideos = paginatePool(source, page, 24);
      if (!name) name = cleanSlug.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }

    return { slug: cleanSlug, name, avatar, videos: finalVideos, page, totalPages };
  });
}

async function uploaderVideos(uploaderPath, page = 1) {
  let cleanPath = String(uploaderPath || '').trim();
  if (cleanPath.startsWith('http')) {
    try { cleanPath = new URL(cleanPath).pathname; } catch {}
  }
  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
  if (!cleanPath.includes('/videos')) {
    cleanPath = cleanPath.replace(/\/+$/, '') + '/videos';
  }
  const key = `uploader-v1:${cleanPath}:${page}`;
  return cached(key, 5 * 60 * 1000, async () => {
    let videos = [];
    let name = '';
    let avatar = null;
    let totalPages = 1;
    try {
      const fullUrl = `${BASE}${cleanPath}${cleanPath.includes('?') ? '&' : '?'}page=${page}`;
      const html = await fetchHtml(fullUrl);
      const $ = cheerio.load(html);
      name = ($('h1').first().text() || '').trim().replace(/\s+/g, ' ');
      if (!name) {
        const parts = cleanPath.split('/').filter(Boolean);
        name = parts[1] ? parts[1].replace(/[-_]/g, ' ') : 'Uploader';
        name = name.charAt(0).toUpperCase() + name.slice(1);
      }
      avatar = $('meta[property="og:image"]').attr('content') ||
               $('.thumbImage img, .userAvatar img, .actorBioAvatar img').attr('src') || null;
      videos = parseCards($);
      registerNewVideos(videos);

      $('.page_number, .pagination li, .pageNumber, a[href*="page="]').each((_, el) => {
        const num = parseInt($(el).text().trim(), 10);
        if (!isNaN(num) && num > totalPages) totalPages = num;
      });
      if (totalPages === 1 && videos.length >= 20) totalPages = page + 1;
    } catch (e) {
      console.warn('[scraper] uploaderVideos error:', e.message);
    }

    if (!videos.length) {
      const pool = getFallbackVideos();
      videos = paginatePool(pool, page, 24);
      if (!avatar && videos[0]) avatar = videos[0].thumbnail;
    }

    return { url: cleanPath, name, avatar, videos, page, totalPages };
  });
}

const STREAM_PRESETS = [];

function extractStreams(html) {
  if (!html) return { streams: [], download: null, downloads: [] };
  const streams = [];
  let download = null;
  const downloads = []; // All qualities for download feature

  // 1. Try parsing JSON mediaDefinitions
  let idx = html.indexOf('"mediaDefinitions":');
  if (idx === -1) idx = html.indexOf('mediaDefinitions:');
  if (idx !== -1) {
    const after = html.indexOf('[', idx);
    if (after !== -1 && after - idx < 30) {
      let depth = 0;
      let end = -1;
      for (let i = after; i < html.length; i++) {
        if (html[i] === '[') depth++;
        else if (html[i] === ']') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end !== -1) {
        try {
          const raw = html.slice(after, end);
          const defs = JSON.parse(raw);
          for (const d of defs) {
            let q = (Array.isArray(d.quality) ? d.quality[0] : (d.quality || d.height || '')).toString();
            const u = (d.videoUrl || '').replace(/\\\/|\//g, '/').replace(/&amp;/g, '&');
            if (!u) continue;
            if (/get_media/.test(u)) {
              download = u;
              // Capture every quality for the download feature
              const dq = (Array.isArray(d.quality) ? d.quality[0] : (d.quality || d.height || '')).toString() || q || 'auto';
              if (!downloads.some((x) => x.url === u)) downloads.push({ quality: dq, url: u });
              continue;
            }
            if (!q) {
              const m = u.match(/(\d{3,4})P_/i) || u.match(/(\d{3,4})p/i);
              if (m) q = m[1];
            }
            if (/\.m3u8/.test(u)) streams.push({ quality: q || 'auto', url: u });
          }
        } catch { /* continue to regex fallback */ }
      }
    }
  }

  // 2. Regex fallback: scan for direct .m3u8 playlist links if mediaDefinitions was empty or missing
  if (streams.length === 0) {
    const m3u8Matches = html.match(/https?:\\?\/\\?\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g) || [];
    const seenUrls = new Set();
    for (let rawUrl of m3u8Matches) {
      const u = rawUrl.replace(/\\\/|\//g, '/').replace(/&amp;/g, '&').replace(/\\"/g, '');
      if (seenUrls.has(u) || !u.includes('phncdn.com')) continue;
      seenUrls.add(u);
      let q = 'auto';
      const m = u.match(/(\d{3,4})P_/i) || u.match(/(\d{3,4})p/i);
      if (m) q = m[1];
      streams.push({ quality: q, url: u });
    }
  }

  // Deduplicate and sort highest quality first
  const uniqueStreams = [];
  const seenQ = new Set();
  for (const s of streams) {
    if (!seenQ.has(s.quality)) {
      seenQ.add(s.quality);
      uniqueStreams.push(s);
    }
  }
  uniqueStreams.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
  return { streams: uniqueStreams, download, downloads };
}

function filterValidComments(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(c => {
    if (!c || typeof c !== 'object') return false;
    const msg = typeof c.message === 'string' ? c.message.trim() : '';
    if (!msg) return false;
    if (msg.includes('[[') || msg.includes(']]')) return false;
    const u = typeof c.user === 'string' ? c.user.trim() : '';
    if (u && msg === u) return false;
    if (u.includes('[[') || u.includes(']]')) return false;
    if (msg.toLowerCase().includes('deleted')) return false;
    return msg.length >= 2 && msg.length <= 1000;
  });
}

/**
 * Computes canonical duration as the sum of #EXTINF segment durations from the HLS media playlist.
 * Single source of truth for playable video length.
 */
async function computeCanonicalHlsDuration(streams) {
  if (!Array.isArray(streams) || streams.length === 0) return null;
  const defaultStream = streams[0];
  if (!defaultStream || !defaultStream.url) return null;

  let streamUrl = defaultStream.url;
  if (streamUrl.includes('u=')) {
    try {
      const match = streamUrl.match(/[?&]u=([^&]+)/);
      if (match && match[1]) {
        streamUrl = decodeURIComponent(match[1]);
      }
    } catch {}
  }

  try {
    const masterRes = await curlText(streamUrl, 10);
    if (!masterRes || !masterRes.text) return null;

    let mediaText = masterRes.text;
    if (mediaText.includes('#EXT-X-STREAM-INF')) {
      const lines = mediaText.split('\n').map((l) => l.trim()).filter(Boolean);
      const mediaRel = lines.find((l) => !l.startsWith('#'));
      if (!mediaRel) return null;

      const mediaUrl = new URL(mediaRel, streamUrl).href;
      const mediaRes = await curlText(mediaUrl, 10);
      if (!mediaRes || !mediaRes.text) return null;
      mediaText = mediaRes.text;
    }

    const extinfRegex = /#EXTINF:\s*([\d.]+)/g;
    let match;
    let totalSec = 0;
    let count = 0;
    while ((match = extinfRegex.exec(mediaText)) !== null) {
      const dur = parseFloat(match[1]);
      if (!isNaN(dur) && dur > 0) {
        totalSec += dur;
        count++;
      }
    }

    if (count > 0 && totalSec > 0) {
      const canonSec = Math.round(totalSec);
      return {
        durationSec: canonSec,
        duration: fmtDur(canonSec),
      };
    }
  } catch (err) {
    console.warn('[scraper] computeCanonicalHlsDuration failed:', err.message);
  }
  return null;
}

async function videoInfo(vkey, forceRefresh = false) {
  const url = `${BASE}/view_video.php?viewkey=${vkey}`;
  const pool = getFallbackVideos();

  // Find matching video card from pool if one exists
  const matchedCard = pool.find(c => c.vkey === vkey || (c.url && c.url.includes(vkey))) || null;

  const cacheKey = `video-live-info-v12:${vkey}`;
  if (forceRefresh) {
    _cache.delete(cacheKey);
  } else {
    // 1. Check L1 in-memory cache (must have canonical HLS duration)
    const l1 = getCache(cacheKey);
    if (l1 && l1.hlsCanonical) {
      if (l1.comments) l1.comments = filterValidComments(l1.comments);
      return l1;
    }

    // 2. Check L2 Postgres DB cache (must have canonical HLS duration)
    try {
      const l2 = await getVideoCache(vkey);
      if (l2 && l2.hlsCanonical) {
        if (l2.comments) l2.comments = filterValidComments(l2.comments);
        setCache(cacheKey, l2, 5 * 60 * 1000);
        return l2;
      }
    } catch (err) {
      console.warn(`[scraper] Video L2 read error:`, err.message);
    }
  }

  return (async () => {
    let title = matchedCard ? matchedCard.title : ('Video ' + vkey);
    let thumbnail = matchedCard ? matchedCard.thumbnail : null;
    let duration = matchedCard?.duration || '15:20';
    let views = matchedCard?.views || '280K views';
    let author = matchedCard?.author || 'Verified Creator';
    let authorAvatar = null;
    let authorBadge = 'Verified Creator';
    let authorSubscribers = null;
    let authorVideos = null;
    let authorUrl = '#';
    let added = matchedCard?.added || '3 days ago';
    if (!added || /months?\s*ago|years?\s*ago|1970/i.test(added)) {
      let h = 0;
      for (let i = 0; i < (vkey || '').length; i++) h = (h * 31 + vkey.charCodeAt(i)) >>> 0;
      const days = (h % 14) + 1;
      added = days === 1 ? 'Yesterday' : (days < 7 ? `${days} days ago` : (days < 14 ? '1 week ago' : '2 weeks ago'));
    }
    let streams = [];
    let download = null;
    let downloads = [];
    let comments = [];
    let pornstarsList = [];
    let authorBio = null;

    // Fetch live page from pornhub.org
    let liveHtml = null;
    let upstreamStatus = 0;
    try {
      const resOrg = await curlText(url, 15);
      upstreamStatus = resOrg.status;
      if (resOrg.status === 200 && resOrg.text && resOrg.text.length > 5000) {
        liveHtml = resOrg.text;
      }
    } catch (e) {
      console.error('[scraper] Live fetch error for ' + vkey + ':', e.message);
    }

    if (!liveHtml && upstreamStatus !== 404 && upstreamStatus !== 410) {
      try {
        const comUrl = url.replace('pornhub.org', 'pornhub.com');
        const resCom = await curlText(comUrl, 15);
        if (resCom.status === 200 && resCom.text && resCom.text.length > 5000) {
          liveHtml = resCom.text;
        } else if (resCom.status === 404 || resCom.status === 410) {
          upstreamStatus = resCom.status;
        }
      } catch {}
    }

    // Validity: the fetched page must actually be THIS video's page.
    // Pornhub redirects unknown viewkeys to the homepage (HTTP 200) — such
    // pages never reference the requested viewkey, while a real video page
    // always does (canonical URL, share links, etc.).
    const fetchedPageIsVideo = !!(liveHtml && liveHtml.includes(vkey));

    const isPageRemoved = (liveHtml && (
      liveHtml.includes('Page Not Found') ||
      liveHtml.includes('This video has been disabled') ||
      liveHtml.includes('Video is no longer available') ||
      liveHtml.includes('class="removedVideo"') ||
      liveHtml.includes('id="pageNotFound"') ||
      liveHtml.includes('class="wrapper-404"')
    )) || upstreamStatus === 404 || upstreamStatus === 410;

    // If upstream returned 404/removed and not in local seed catalog -> 404 error
    if (!matchedCard && (isPageRemoved || !liveHtml)) {
      const notFoundErr = new Error('video not found');
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    if (liveHtml && liveHtml.length > 5000 && !isPageRemoved) {
      const $ = cheerio.load(liveHtml);
      const lt = ($('meta[property="og:title"]').attr('content') || $('h1.title').first().text() || '').trim().replace(/\s+/g, ' ');
      const lth = $('meta[property="og:image"]').attr('content') || null;
      if (lt && !lt.includes('Page Not Found') && !lt.includes('Pornhub')) {
        title = lt;
      } else if (!matchedCard) {
        const notFoundErr = new Error('video not found');
        notFoundErr.status = 404;
        throw notFoundErr;
      }
      if (lth) thumbnail = lth;
      const vText = $('.views .count, .video-info-row .views').first().text().trim().replace(/\s+/g, ' ');
      if (vText) views = vText;

      const liveDate = $('.video-info-row .uploadDate, .video-info-row .date, .uploadDate').first().text().trim().replace(/\s+/g, ' ');
      if (liveDate && !/\b(5[0-9]|[6-9]\d|\d{3,})\s*years?\s*ago\b/i.test(liveDate) && !/1970/i.test(liveDate)) {
        added = liveDate;
      }

      // Extract Uploader Info
      let authorFound = null;
      const mUploader = liveHtml.match(/"video_uploader_name"\s*:\s*"([^"]+)"/) || liveHtml.match(/"author"\s*:\s*"([^"]+)"/);
      if (mUploader && mUploader[1]) authorFound = mUploader[1];

      const $upBlock = $('.userInfoBlock, .video-uploader-block, .userInfo').first();
      const upImg = $upBlock.find('.userAvatar img, img.avatarTrigger, img').first().attr('src') ||
                    $upBlock.find('.userAvatar img, img.avatarTrigger, img').first().attr('data-src') || null;
      if (upImg) authorAvatar = upImg;

      if (!authorFound) {
        $upBlock.find('a.bolded, a.usernameLink, a[href*="/pornstar/"], a[href*="/model/"], a[href*="/channels/"], a[href*="/users/"]').each((i, el) => {
          const t = $(el).text().trim();
          if (t && !authorFound) authorFound = t;
        });
      }
      if (authorFound) author = authorFound;

      const upLink = $upBlock.find('a[href*="/pornstar/"], a[href*="/model/"], a[href*="/channels/"], a[href*="/users/"]').first();
      const aHref = upLink.attr('href');
      if (aHref) authorUrl = aHref;

      // Extract Pornstars (skip numeric IDs / unresolved tags)
      pornstarsList = [];
      $('.pornstarsWrapper a, .pornstarWrapper a, .pornstars a, a[href*="/pornstar/"]').each((_, pEl) => {
        const pName = $(pEl).text().trim().replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '').trim();
        const pHref = $(pEl).attr('href') || '';
        const m = pHref.match(/\/pornstar\/([^/?#]+)/i);
        const pSlug = m ? m[1] : pName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (pName && pSlug && !/^\d+$/.test(pName) && !/^\d+$/.test(pSlug) && !pornstarsList.some((p) => p.slug === pSlug)) {
          pornstarsList.push({ name: pName, slug: pSlug });
        }
      });

      const verifiedBadge = $upBlock.find('.verified-icon, .userBadges').first().attr('data-title');
      if (verifiedBadge) authorBadge = verifiedBadge;

      $upBlock.find('span').each((i, el) => {
        let txt = $(el).text().trim();
        if (/\d+[\d.,]*\s*Videos/i.test(txt)) {
          txt = txt.replace(/\b(\d{1,3})\.(\d{3})\b/g, '$1,$2').replace(/\b(\d{4,})\b/g, (m) => parseInt(m, 10).toLocaleString('en-US'));
          authorVideos = txt;
        }
        if (/\d+[\d.,]*[KMB]?\s*Subscribers/i.test(txt)) {
          txt = txt.replace(/\b(\d{1,3})\.(\d{3})\b/g, '$1,$2').replace(/\b(\d{4,})\b/g, (m) => parseInt(m, 10).toLocaleString('en-US'));
          authorSubscribers = txt;
        }
      });

      // Extract Bio if present (no fake template strings)
      const bioText = $('.bio, .userBio, .profileBio, .aboutText').first().text().trim();
      if (bioText && bioText.length > 2) {
        authorBio = bioText.replace(/\s+/g, ' ');
      }

      // Extract Real Comments (skip template blocks and placeholders)
      $('.commentBlock').slice(0, 30).each((i, el) => {
        const rawClass = $(el).attr('class') || '';
        const rawHtml = $(el).html() || '';
        if (rawClass.includes('[[') || rawHtml.includes('[[id]]') || rawHtml.includes('[[commentMessage]]')) {
          return;
        }

        let user = $(el).find('img.commentAvatarImg').first().attr('alt') ||
                   $(el).find('img.commentAvatarImg').first().attr('title');
        if (!user || user.includes('[[')) {
          $(el).find('a[href*="/users/"], a.usernameLink').each((_, uEl) => {
            const t = $(uEl).text().trim();
            if (t && !user && !t.includes('[[')) user = t;
          });
        }
        if (!user || user.includes('[[')) {
          user = 'User_' + (comments.length + 1);
        }

        let cAvatar = $(el).find('img.commentAvatarImg, img').first().attr('src') || '';
        if (cAvatar.includes('[[')) cAvatar = '';

        let date = $(el).find('.date').first().text().trim().replace(/\s+/g, ' ') || 'recently';
        if (date.includes('[[')) date = 'recently';

        let message = '';
        const $msgSpan = $(el).find('.commentMessage span').first();
        if ($msgSpan.length > 0) {
          message = $msgSpan.text().trim().replace(/\s+/g, ' ');
        }
        if (!message || message.includes('[[')) {
          const $msg = $(el).find('.commentMessage').clone();
          $msg.find('.actionButtonsBlock, .buttonBlockRight, .replyBlock, script, style').remove();
          message = $msg.text().trim().replace(/\s+/g, ' ');
        }

        const upvotes = parseInt($(el).find('.voteTotal').first().text().trim(), 10) || 0;
        if (message && message.length >= 2 && message.length <= 1000 && !message.includes('[[') && !message.includes(']]') && !message.toLowerCase().includes('deleted') && message !== user) {
          comments.push({ id: `c_${comments.length}`, user, avatar: cAvatar, date, message, upvotes });
        }
      });

      comments = filterValidComments(comments);

      const r = extractStreams(liveHtml);
      if (r.streams && r.streams.length > 0) {
        streams = r.streams;
      }
      if (r.download) download = r.download;
      if (r.downloads && r.downloads.length > 0) downloads = r.downloads;
    }

    if (!streams) {
      streams = [];
    }

    // Embed stream extraction fallback if main page did not yield streams
    if (streams.length === 0 && vkey) {
      try {
        const embedUrl = `https://www.pornhub.org/embed/${vkey}`;
        const embedRes = await curlText(embedUrl, 12);
        if (embedRes && embedRes.text && embedRes.text.length > 1000) {
          const er = extractStreams(embedRes.text);
          if (er.streams && er.streams.length > 0) streams = er.streams;
          if (er.download && !download) download = er.download;
        }
      } catch (e) {}
    }

    if (streams.length === 0 && vkey) {
      try {
        const embedUrl = `https://www.pornhub.com/embed/${vkey}`;
        const embedRes = await curlText(embedUrl, 12);
        if (embedRes && embedRes.text && embedRes.text.length > 1000) {
          const er = extractStreams(embedRes.text);
          if (er.streams && er.streams.length > 0) streams = er.streams;
          if (er.download && !download) download = er.download;
        }
      } catch (e) {}
    }

    if (streams.length === 0 && vkey) {
      try {
        const embedUrl = `https://rt.pornhub.com/embed/${vkey}`;
        const embedRes = await curlText(embedUrl, 12);
        if (embedRes && embedRes.text && embedRes.text.length > 1000) {
          const er = extractStreams(embedRes.text);
          if (er.streams && er.streams.length > 0) streams = er.streams;
          if (er.download && !download) download = er.download;
        }
      } catch (e) {}
    }

    // If streams are still 0, fail honestly — NEVER substitute another
    // video's streams. (The old "borrow from activeKeys" fallback played the
    // wrong video under the wrong title/thumbnail: "same video plays, only
    // thumbnail differs".) 404 when the video is confirmed missing/invalid;
    // otherwise throw a retryable 502 so the player offers Retry.
    if (streams.length === 0) {
      if (!matchedCard || isPageRemoved || (liveHtml && !fetchedPageIsVideo)) {
        const notFoundErr = new Error('video not found');
        notFoundErr.status = 404;
        throw notFoundErr;
      }
      const unavailableErr = new Error('streams temporarily unavailable');
      unavailableErr.status = 502;
      throw unavailableErr;
    }

    // Deterministic metrics for fallback display
    let hashVal = 0;
    for (let i = 0; i < (vkey || '').length; i++) hashVal = (hashVal * 31 + vkey.charCodeAt(i)) >>> 0;
    const upNum = 1200 + (hashVal % 15000);
    const downNum = 30 + (hashVal % 300);
    const percent = Math.round((upNum / (upNum + downNum)) * 100);

    // Single Source of Truth: compute canonical duration from HLS media playlist (#EXTINF sum)
    let canonicalHls = null;
    if (streams && streams.length > 0) {
      try {
        canonicalHls = await computeCanonicalHlsDuration(streams);
        if (canonicalHls && canonicalHls.durationSec > 0) {
          duration = canonicalHls.duration;
          durationSec = canonicalHls.durationSec;
        }
      } catch (err) {
        console.warn(`[scraper] HLS duration calculation failed for ${vkey}:`, err.message);
      }
    }

    if (!thumbnail) {
      thumbnail = matchedCard?.thumbnail || '/og-image.jpg';
    }

    if (!authorAvatar) {
      authorAvatar = `/api/avatar?name=${encodeURIComponent(author || 'Creator')}`;
    }
    if (!authorSubscribers) {
      const subK = 25 + (hashVal % 280);
      authorSubscribers = `${subK}.${hashVal % 9}K Subscribers`;
    }
    if (!authorVideos) {
      const vidCount = 35 + (hashVal % 150);
      authorVideos = `${vidCount} Videos`;
    }

    // Related videos
    const relRng = seededRandom(`rel:${vkey}`);
    const relPool = pool.filter(c => c.vkey !== vkey && c.title !== title && parseDurationSec(c.duration) >= 600);
    const shuffledRel = [...relPool];
    for (let i = shuffledRel.length - 1; i > 0; i--) {
      const j = Math.floor(relRng() * (i + 1));
      [shuffledRel[i], shuffledRel[j]] = [shuffledRel[j], shuffledRel[i]];
    }
    const related = shuffledRel.slice(0, 24);

    const categoriesArr = [
      { name: 'HD Porn', slug: '/video?o=tr' },
      { name: 'Amateur', slug: '/video?c=3' },
      { name: 'Verified Amateurs', slug: '/video?c=138' },
      { name: 'Blowjob', slug: '/video?c=13' },
      { name: 'POV', slug: '/video?c=8' }
    ];

    const tags = ['HD', '1080p', 'Amateur', 'Verified', 'POV', 'Babe', 'Exclusive'];

    const result = {
      vkey,
      url: `https://www.pornhub.com/view_video.php?viewkey=${vkey}`,
      title,
      thumbnail,
      duration: duration && duration !== '0:00' && duration !== '0' ? duration : '--:--',
      durationSec: durationSec || (matchedCard?.durationSec ? matchedCard.durationSec : (parseDurationSec(duration) || (900 + (hashVal % 600)))),
      hlsCanonical: Boolean(canonicalHls),
      views,
      viewsNum: parseCompact(views) || (matchedCard?.viewsNum || 280000),
      percent,
      upVotes: `${(upNum / 1000).toFixed(1)}K`,
      downVotes: `${downNum}`,
      uploadDate: added,
      tags,
      categories: categoriesArr,
      pornstars: (pornstarsList && pornstarsList.length) ? pornstarsList : [],
      pornstarsList: (pornstarsList && pornstarsList.length) ? pornstarsList : [],
      author,
      authorAvatar,
      authorBadge,
      authorSubscribers,
      authorVideos,
      authorUrl,
      authorLink: authorUrl,
      authorBio: authorBio || null,
      comments: filterValidComments(comments),
      related,
      streams,
      download,
      downloads,
    };

    // Populate L1 and L2 (expiresAt = now + 10 minutes)
    setCache(cacheKey, result, 5 * 60 * 1000);
    try {
      await setVideoCache(vkey, result, 10 * 60);
    } catch (err) {
      console.warn(`[scraper] Video L2 write error:`, err.message);
    }

    return result;
  })();
}

function fmtDur(s) {
  if (s === null || s === undefined || s === '' || s === 0 || s === '0' || s === '0:00' || s === '--:--') return '--:--';
  const num = typeof s === 'number' ? s : parseDurationSec(s);
  if (isNaN(num) || num <= 0) return '--:--';
  const rounded = Math.round(num);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const sec = rounded % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

function parseCompact(txt) {
  if (!txt) return null;
  const m = String(txt).trim().match(/^([\d.]+)\s*([KMB])?$/i);
  if (!m) { const n = parseInt(String(txt).replace(/\D/g, '')); return isNaN(n) ? null : n; }
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

/* ---------------- HLS proxy helpers ---------------- */
async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  const isPh = /pornhub\.com$/i.test(new URL(url).hostname);
  const headers = { 'User-Agent': UA, 'Accept': '*/*' };
  if (isPh) { headers['Cookie'] = cookieHeader(); headers['Referer'] = BASE + '/'; }
  const res = await fetch(url, {
    headers,
    dispatcher: dispatcher(), redirect: 'follow', signal: ctrl.signal,
  });
  clearTimeout(t);
  storeCookies(res);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  return { text, contentType: ct };
}

function rewritePlaylist(masterUrl, body, toProxied) {
  return body.split('\n').map(line => {
    const t = line.trim();
    if (!t) return line;

    // Rewrite #EXT-X-MAP:URI="..." for fragmented MP4
    if (t.startsWith('#EXT-X-MAP:')) {
      return line.replace(/URI="([^"]+)"/g, (match, u) => {
        try {
          const abs = new URL(u, masterUrl).toString();
          return `URI="${toProxied(abs)}"`;
        } catch {
          return match;
        }
      });
    }

    // Rewrite #EXT-X-MEDIA:...URI="..."
    if (t.startsWith('#EXT-X-MEDIA:')) {
      return line.replace(/URI="([^"]+)"/g, (match, u) => {
        try {
          const abs = new URL(u, masterUrl).toString();
          return `URI="${toProxied(abs)}"`;
        } catch {
          return match;
        }
      });
    }

    if (t.startsWith('#')) return line;
    let abs;
    try { abs = new URL(t, masterUrl).toString(); } catch { return line; }
    return toProxied(abs);
  }).join('\n');
}

module.exports = {
  BASE, feed, searchVideos, categories, categoryVideos, videoInfo, warmup,
  fetchText, rewritePlaylist, fmtDur, _fetchHtml: fetchHtml, getFallbackVideos, STREAM_PRESETS,
  registerNewVideos, autoSyncNewVideos, extractStreams, filterValidComments,
  pornstarVideos, uploaderVideos, computeCanonicalHlsDuration, parseDurationSec,
};
