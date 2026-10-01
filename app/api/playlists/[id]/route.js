import { NextResponse } from 'next/server';
import prisma from '../../../../lib/db.js';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid') || '';

    if (!id) {
      return NextResponse.json({ error: 'Missing playlist id' }, { status: 400 });
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { addedAt: 'asc' },
        },
      },
    });

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    // If private, only the owner can view it
    if (!playlist.isPublic && playlist.userId !== uid) {
      return NextResponse.json({ error: 'This playlist is private' }, { status: 403 });
    }

    return NextResponse.json({ playlist }, { status: 200 });
  } catch (err) {
    console.error('[playlist item API] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch playlist' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid') || '';

    if (!id) {
      return NextResponse.json({ error: 'Missing playlist id' }, { status: 400 });
    }

    try {
      if (prisma && prisma.playlistItem) {
        await prisma.playlistItem.deleteMany({ where: { playlistId: id } }).catch(() => {});
      }
      if (prisma && prisma.playlist) {
        await prisma.playlist.delete({ where: { id } }).catch(() => {});
      }
    } catch (dbErr) {
      console.warn('[playlist DELETE] prisma delete fallback:', dbErr.message);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[playlist item API] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete playlist' }, { status: 500 });
  }
}
