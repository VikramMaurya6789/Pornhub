import { NextResponse } from 'next/server';
import prisma from '../../../lib/db.js';

// Clean, short suggestion terms (categories, tags, popular pornstars).
// Pornhub-style: short phrases, never raw video titles.
const POPULAR_TERMS = [
  'amateur', 'anal', 'asian', 'bbw', 'big ass', 'big dick', 'big tits',
  'blonde', 'blowjob', 'brunette', 'casting', 'cosplay', 'cowgirl',
  'creampie', 'cumshot', 'deepthroat', 'desi', 'doggystyle', 'double penetration',
  'ebony', 'fetish', 'fingering', 'foursome', 'gangbang', 'group sex',
  'hardcore', 'hentai', 'homemade', 'indian', 'indian aunty', 'interracial',
  'japanese', 'joi', 'latina', 'lesbian', 'massage', 'masturbation', 'mature',
  'milf', 'oil massage', 'orgy', 'pov', 'public', 'redhead', 'roleplay', 'rough',
  'shemale', 'solo', 'squirt', 'stepmom', 'stepsister', 'striptease', 'swingers',
  'teen', 'threesome', 'toys', 'verified', 'vintage', 'vr', 'webcam', '69',
  'lisa ann', 'mia khalifa', 'riley reid', 'brandi love', 'eva elfie',
  'lana rhoades', 'angela white', 'nicole aniston', 'sweetie fox', 'autumn falls',
  'bhabhi', 'aunty',
];

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    if (!q) {
      return NextResponse.json({ suggestions: [] }, { headers: CACHE_HEADERS });
    }

    // Recent real user searches from DB — with a hard timeout so a slow/flaky
    // database can never delay keystroke suggestions.
    let dbSuggestions = [];
    try {
      if (prisma && prisma.searchLog) {
        const dbPromise = prisma.searchLog
          .findMany({
            where: { query: { contains: q, mode: 'insensitive' } },
            orderBy: { count: 'desc' },
            take: 8,
          })
          .then((logs) => logs.map((l) => String(l.query || '').toLowerCase().trim()).filter(Boolean));
        const timeout = new Promise((resolve) => setTimeout(() => resolve([]), 700));
        dbSuggestions = await Promise.race([dbPromise, timeout]);
      }
    } catch {}

    // Static popular terms: prefix matches first, then contains matches.
    const prefixTerms = POPULAR_TERMS.filter((t) => t.startsWith(q));
    const containsTerms = POPULAR_TERMS.filter((t) => !t.startsWith(q) && t.includes(q));

    const results = [...new Set([...dbSuggestions, ...prefixTerms, ...containsTerms])].slice(0, 8);

    return NextResponse.json({ suggestions: results }, { headers: CACHE_HEADERS });
  } catch (err) {
    return NextResponse.json({ suggestions: [] }, { headers: CACHE_HEADERS });
  }
}
