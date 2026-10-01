import { NextResponse } from 'next/server';
import prisma from '../../../lib/db.js';

function getUserId(req, body = null) {
  const { searchParams } = new URL(req.url);
  const fromQuery = searchParams.get('uid') || searchParams.get('userId');
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();

  const fromHeader = req.headers.get('x-user-id');
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();

  if (body) {
    if (body.uid && typeof body.uid === 'string') return body.uid.trim();
    if (body.userId && typeof body.userId === 'string') return body.userId.trim();
  }
  return null;
}

// GET /api/history?uid=
export async function GET(req) {
  try {
    const uid = getUserId(req);
    if (!uid) {
      return NextResponse.json({ history: [] }, { status: 200 });
    }

    const rows = await prisma.watchHistory.findMany({
      where: { userId: uid },
      orderBy: { updatedAt: 'desc' },
      take: 24,
    });

    return NextResponse.json({ history: rows }, { status: 200 });
  } catch (err) {
    console.warn('[API /api/history GET] DB error:', err.message);
    // Graceful degradation: return empty history on DB failure
    return NextResponse.json({ history: [] }, { status: 200 });
  }
}

// POST /api/history
export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const uid = getUserId(req, body);
    const vkey = body?.vkey;
    const title = body?.title || null;
    const thumbnail = body?.thumbnail || null;
    const durationSec = typeof body?.durationSec === 'number' ? Math.round(body.durationSec) : null;
    const progressSec = typeof body?.progressSec === 'number' ? Math.max(0, Math.round(body.progressSec)) : 0;

    if (!uid || !vkey) {
      return NextResponse.json({ error: 'Missing userId or vkey' }, { status: 400 });
    }

    const record = await prisma.watchHistory.upsert({
      where: {
        userId_vkey: {
          userId: uid,
          vkey: String(vkey),
        },
      },
      create: {
        userId: uid,
        vkey: String(vkey),
        title: title ? String(title) : null,
        thumbnail: thumbnail ? String(thumbnail) : null,
        durationSec,
        progressSec,
      },
      update: {
        title: title ? String(title) : undefined,
        thumbnail: thumbnail ? String(thumbnail) : undefined,
        durationSec: durationSec ?? undefined,
        progressSec,
      },
    });

    return NextResponse.json({ ok: true, history: record }, { status: 200 });
  } catch (err) {
    console.warn('[API /api/history POST] DB error:', err.message);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}

// DELETE /api/history?uid=&vkey=
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    let vkey = searchParams.get('vkey');
    let body = null;

    if (!vkey) {
      try {
        body = await req.json();
        vkey = body?.vkey;
      } catch {}
    }

    const uid = getUserId(req, body);

    if (!uid) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (vkey === 'all' || !vkey) {
      await prisma.watchHistory.deleteMany({
        where: { userId: uid },
      });
      return NextResponse.json({ ok: true, cleared: true }, { status: 200 });
    }

    await prisma.watchHistory.deleteMany({
      where: {
        userId: uid,
        vkey: String(vkey),
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.warn('[API /api/history DELETE] DB error:', err.message);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}
