import { NextResponse } from 'next/server';
import prisma from '../../../lib/db.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const DEFAULT_TRENDING = [
  'Japanese',
  'Milf',
  'Anal',
  'Threesome',
  'Step Mom',
  'Blowjob',
  'Lesbian',
  'Massage',
  'Ebony',
  'POV',
];

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logs = await prisma.searchLog.findMany({
      where: {
        updatedAt: { gte: sevenDaysAgo },
      },
      orderBy: { count: 'desc' },
      take: 10,
    });

    const dbQueries = logs.map((l) => l.query.trim()).filter(Boolean);
    const combined = Array.from(new Set([...dbQueries, ...DEFAULT_TRENDING])).slice(0, 10);

    return NextResponse.json(
      { queries: combined },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
          ...CORS_HEADERS,
        },
      }
    );
  } catch (err) {
    console.warn('[API /api/trending-searches] DB error, using default list:', err.message);
    return NextResponse.json(
      { queries: DEFAULT_TRENDING },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
          ...CORS_HEADERS,
        },
      }
    );
  }
}
