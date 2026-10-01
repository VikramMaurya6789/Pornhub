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

// GET /api/favorites?uid=
export async function GET(req) {
  try {
    const uid = getUserId(req);
    if (!uid) {
      return NextResponse.json({ favorites: [] }, { status: 200 });
    }

    const rows = await prisma.favorite.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ favorites: rows }, { status: 200 });
  } catch (err) {
    console.warn('[API /api/favorites GET] DB error:', err.message);
    // Graceful degradation: return empty favorites on DB failure so page never 500s
    return NextResponse.json({ favorites: [] }, { status: 200 });
  }
}

// POST /api/favorites
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

    if (!uid || !vkey) {
      return NextResponse.json({ error: 'Missing userId or vkey' }, { status: 400 });
    }

    const fav = await prisma.favorite.upsert({
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
      },
      update: {
        title: title ? String(title) : null,
        thumbnail: thumbnail ? String(thumbnail) : null,
      },
    });

    return NextResponse.json({ ok: true, favorite: fav }, { status: 200 });
  } catch (err) {
    console.warn('[API /api/favorites POST] DB error:', err.message);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}

// DELETE /api/favorites?uid=&vkey=
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

    if (!uid || !vkey) {
      return NextResponse.json({ error: 'Missing userId or vkey' }, { status: 400 });
    }

    await prisma.favorite.deleteMany({
      where: {
        userId: uid,
        vkey: String(vkey),
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.warn('[API /api/favorites DELETE] DB error:', err.message);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}
