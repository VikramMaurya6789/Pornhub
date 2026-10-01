import { NextResponse } from 'next/server';
import prisma from '../../../lib/db.js';
import { formatViews } from '../../../lib/format.js';

// Server-side best-effort deduplication map (uid+vkey -> timestamp)
const recentViews = new Map();

function isDuplicate(key) {
  const now = Date.now();
  const last = recentViews.get(key);
  if (last && now - last < 24 * 60 * 60 * 1000) {
    return true;
  }
  recentViews.set(key, now);

  if (recentViews.size > 50000) {
    for (const [k, ts] of recentViews.entries()) {
      if (now - ts > 24 * 60 * 60 * 1000) recentViews.delete(k);
    }
  }
  return false;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const vkey = (searchParams.get('vkey') || '').trim();

    if (!vkey) {
      return NextResponse.json({ error: 'Missing vkey' }, { status: 400 });
    }

    let viewsCount = 0;
    try {
      const stat = await prisma.videoStat.findUnique({ where: { vkey } });
      viewsCount = stat?.views || 0;
    } catch {
      // Fallback
    }

    return NextResponse.json({
      views: viewsCount,
      formatted: formatViews(viewsCount),
    });
  } catch {
    return NextResponse.json({ views: 0, formatted: '0 views' });
  }
}

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {}

    const vkey = (body.vkey || '').trim();
    const uid = (body.uid || '').trim();

    if (!vkey) {
      return NextResponse.json({ error: 'vkey is required' }, { status: 400 });
    }

    const dedupeKey = `${uid || 'anon'}:${vkey}`;
    const duplicate = isDuplicate(dedupeKey);

    let currentViews = 1;
    try {
      if (!duplicate) {
        const stat = await prisma.videoStat.upsert({
          where: { vkey },
          create: { vkey, views: 1 },
          update: { views: { increment: 1 } },
        });
        currentViews = stat.views;
      } else {
        const stat = await prisma.videoStat.findUnique({ where: { vkey } });
        currentViews = stat?.views || 1;
      }
    } catch (err) {
      console.warn('[views API] DB error:', err.message);
    }

    return NextResponse.json({
      ok: true,
      views: currentViews,
      formatted: formatViews(currentViews),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}
