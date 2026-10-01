import { NextResponse } from 'next/server';
import prisma from '../../../lib/db.js';
import { SEED_VIDEOS } from '../../../lib/seedData.js';

const POPULAR_TERMS = [
  'amateur', 'anal', 'asian', 'bbw', 'big ass', 'big dick', 'blowjob', 'brunette',
  'creampie', 'cumshot', 'ebony', 'fetish', 'gangbang', 'hardcore', 'hentai',
  'interracial', 'japanese', 'latina', 'lesbian', 'massage', 'masturbation',
  'mature', 'milf', 'pov', 'public', 'redhead', 'rough', 'shemale', 'solo',
  'squirt', 'teen', 'threesome', 'toys', 'vintage', 'vr', 'verified',
  'lisa ann', 'mia khalifa', 'riley reid', 'brandi love', 'eva elfie',
  'lana rhoades', 'angela white', 'nicole aniston', 'sweetie fox', 'autumn falls'
];

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    if (!q) {
      return NextResponse.json(
        { suggestions: [] },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        }
      );
    }

    let dbSuggestions = [];
    try {
      if (prisma && prisma.searchLog) {
        const logs = await prisma.searchLog.findMany({
          where: {
            query: {
              contains: q,
              mode: 'insensitive',
            },
          },
          orderBy: { count: 'desc' },
          take: 8,
        });
        dbSuggestions = logs.map((l) => l.query.toLowerCase());
      }
    } catch {}

    // Match static popular terms (prefix first, then contains)
    const prefixTerms = POPULAR_TERMS.filter((t) => t.startsWith(q));
    const containsTerms = POPULAR_TERMS.filter((t) => !t.startsWith(q) && t.includes(q));

    // Match existing video titles from SEED_VIDEOS
    const videoMatches = [];
    if (Array.isArray(SEED_VIDEOS)) {
      for (const item of SEED_VIDEOS) {
        if (item.title && typeof item.title === 'string') {
          const tLower = item.title.toLowerCase();
          if (tLower.includes(q)) {
            // If the query matches a phrase or title, push clean title snippet
            videoMatches.push(item.title);
          }
        }
      }
    }

    const combined = [...new Set([...dbSuggestions, ...prefixTerms, ...containsTerms, ...videoMatches])];
    const results = combined.slice(0, 8);

    return NextResponse.json(
      { suggestions: results },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { suggestions: [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  }
}
