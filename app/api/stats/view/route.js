import { NextResponse } from 'next/server';
import prisma from '../../../../lib/db.js';

// POST /api/stats/view { vkey }
export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const vkey = body?.vkey;
    if (!vkey || typeof vkey !== 'string') {
      return NextResponse.json({ error: 'Missing vkey' }, { status: 400 });
    }

    const stat = await prisma.videoStat.upsert({
      where: { vkey: String(vkey) },
      create: {
        vkey: String(vkey),
        views: 1,
      },
      update: {
        views: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true, views: stat.views }, { status: 200 });
  } catch (err) {
    console.warn('[API /api/stats/view POST] DB error:', err.message);
    // Graceful degradation: return 200 with ok: false so client analytics calls never fail page experience
    return NextResponse.json({ ok: false, warning: 'Database unavailable' }, { status: 200 });
  }
}
