import { NextResponse } from 'next/server';
import prisma from '../../../lib/db.js';
import { formatMaxViews } from '../../../lib/format.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const vkey = (searchParams.get('vkey') || '').trim();

    if (!vkey) {
      return NextResponse.json({ error: 'Missing vkey' }, { status: 400, headers: CORS_HEADERS });
    }

    let viewsCount = 0;
    try {
      if (prisma && prisma.videoStat) {
        const stat = await prisma.videoStat.findUnique({ where: { vkey } });
        viewsCount = stat?.views || 0;
      }
    } catch {}

    return NextResponse.json(
      {
        views: viewsCount,
        formatted: formatMaxViews(0, viewsCount),
      },
      { headers: CORS_HEADERS }
    );
  } catch {
    return NextResponse.json({ views: 0, formatted: '0 views' }, { status: 200, headers: CORS_HEADERS });
  }
}

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {}

    const vkey = (body.vkey || '').trim();
    if (!vkey) {
      return NextResponse.json({ error: 'Missing vkey' }, { status: 400, headers: CORS_HEADERS });
    }

    let viewsCount = 1;
    try {
      if (prisma && prisma.videoStat) {
        const stat = await prisma.videoStat.upsert({
          where: { vkey },
          update: { views: { increment: 1 } },
          create: { vkey, views: 1 },
        });
        viewsCount = stat.views;
      }
    } catch (e) {
      console.warn('[api/view] Prisma increment error:', e.message);
    }

    return NextResponse.json(
      {
        views: viewsCount,
        formatted: formatMaxViews(0, viewsCount),
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to increment view' }, { status: 500, headers: CORS_HEADERS });
  }
}
