import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/db.js';

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const vkey = (body.vkey || '').trim();
    const title = body.title || null;
    const thumbnail = body.thumbnail || null;

    if (!id || !vkey) {
      return NextResponse.json({ error: 'Missing playlist id or vkey' }, { status: 400 });
    }

    // Verify playlist exists
    const playlist = await prisma.playlist.findUnique({ where: { id } });
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    // Upsert playlist item so duplicates are prevented
    const count = await prisma.playlistItem.count({ where: { playlistId: id } });

    const item = await prisma.playlistItem.upsert({
      where: {
        playlistId_vkey: {
          playlistId: id,
          vkey,
        },
      },
      update: {
        title,
        thumbnail,
      },
      create: {
        playlistId: id,
        vkey,
        title,
        thumbnail,
        position: count,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error('[playlist items API] POST error:', err);
    return NextResponse.json({ error: 'Failed to add item to playlist' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    let vkey = '';

    try {
      const body = await req.json();
      vkey = body?.vkey || '';
    } catch {
      const { searchParams } = new URL(req.url);
      vkey = searchParams.get('vkey') || '';
    }

    vkey = (vkey || '').trim();
    if (!id || !vkey) {
      return NextResponse.json({ error: 'Missing playlist id or vkey' }, { status: 400 });
    }

    await prisma.playlistItem.deleteMany({
      where: {
        playlistId: id,
        vkey,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[playlist items API] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete item from playlist' }, { status: 500 });
  }
}
