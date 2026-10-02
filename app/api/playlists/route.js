import { NextResponse } from 'next/server';
import prisma from '../../../lib/db.js';
import { getEffectiveUid } from '../../../lib/auth.js';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = await getEffectiveUid((searchParams.get('uid') || '').trim());

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    const playlists = await prisma.playlist.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          orderBy: { addedAt: 'desc' },
          take: 4,
        },
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json({ playlists }, { status: 200 });
  } catch (err) {
    console.error('[playlists API] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const uid = await getEffectiveUid((body.uid || '').trim());
    const name = (body.name || '').trim();
    const isPublic = body.isPublic !== undefined ? Boolean(body.isPublic) : true;

    if (!uid || !name) {
      return NextResponse.json({ error: 'uid and name are required' }, { status: 400 });
    }

    const playlist = await prisma.playlist.create({
      data: {
        userId: uid,
        name,
        isPublic,
      },
    });

    return NextResponse.json({ playlist }, { status: 201 });
  } catch (err) {
    console.error('[playlists API] POST error:', err);
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 });
  }
}
