import { NextResponse } from 'next/server';
import prisma from '../../../lib/db.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

function timeAgo(date) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function shapeComment(c) {
  const author = c.author || 'Anonymous';
  return {
    id: c.id,
    vkey: c.vkey,
    user: author,
    avatar: `/api/avatar?name=${encodeURIComponent(author)}`,
    date: timeAgo(c.createdAt),
    message: c.message,
    upvotes: c.upvotes || 0,
    downvotes: c.downvotes || 0,
    parentId: c.parentId || null,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  };
}

function dbAvailable() {
  return !!(prisma && prisma.comment);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const vkey = searchParams.get('vkey');
    if (!vkey) {
      return NextResponse.json({ error: 'vkey required' }, { status: 400, headers: CORS_HEADERS });
    }

    if (!dbAvailable()) {
      return NextResponse.json({ comments: [], db: false }, { status: 200, headers: CORS_HEADERS });
    }

    const rows = await prisma.comment.findMany({
      where: { vkey },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(
      { comments: rows.map(shapeComment) },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
          ...CORS_HEADERS,
        },
      }
    );
  } catch (err) {
    console.error('[API /api/comments] GET error:', err.message);
    return NextResponse.json({ comments: [] }, { status: 200, headers: CORS_HEADERS });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS });
    }

    const vkey = String(body.vkey || '').trim();
    const uid = String(body.uid || '').trim();
    const userId = typeof body.userId === 'string' ? body.userId.trim().slice(0, 64) : null;
    const rawText = String(body.text || body.message || '').trim();
    const rawAuthor = String(body.author || body.user || '').trim();

    if (!vkey) {
      return NextResponse.json({ error: 'vkey is required' }, { status: 400, headers: CORS_HEADERS });
    }
    if (!uid && !userId) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400, headers: CORS_HEADERS });
    }
    if (!rawText) {
      return NextResponse.json({ error: 'Comment text cannot be empty' }, { status: 400, headers: CORS_HEADERS });
    }
    if (rawText.length > 500) {
      return NextResponse.json({ error: 'Comment must be 500 characters or less' }, { status: 400, headers: CORS_HEADERS });
    }

    if (!dbAvailable()) {
      return NextResponse.json(
        { error: 'Comments are temporarily unavailable. Please try again later.' },
        { status: 503, headers: CORS_HEADERS }
      );
    }

    // DB-backed rate limit: 1 comment per 30 seconds per uid
    const rateKey = uid || userId;
    const recent = await prisma.comment.findFirst({
      where: {
        uid: rateKey,
        createdAt: { gte: new Date(Date.now() - 30000) },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (recent) {
      const waitSec = Math.ceil((recent.createdAt.getTime() + 30000 - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Please wait ${Math.max(1, waitSec)}s before posting another comment` },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    const author = escapeHtml(rawAuthor.slice(0, 40)) || 'Anonymous';
    const message = escapeHtml(rawText);
    const parentId = typeof body.parentId === 'string' ? body.parentId.trim().slice(0, 64) || null : null;

    const created = await prisma.comment.create({
      data: {
        vkey,
        uid: uid || null,
        userId: userId || null,
        author,
        message,
        parentId,
      },
    });

    return NextResponse.json(
      { success: true, comment: shapeComment(created) },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[API /api/comments] POST error:', err.message);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS });
    }

    const commentId = String(body.commentId || '').trim();
    const vote = String(body.vote || '').trim(); // 'up' or 'down'

    if (!commentId || !['up', 'down'].includes(vote)) {
      return NextResponse.json({ error: 'commentId and vote (up/down) required' }, { status: 400, headers: CORS_HEADERS });
    }

    if (!dbAvailable()) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: CORS_HEADERS });
    }

    const field = vote === 'up' ? 'upvotes' : 'downvotes';
    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { [field]: { increment: 1 } },
    });

    return NextResponse.json(
      { success: true, comment: shapeComment(updated) },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[API /api/comments] PATCH error:', err.message);
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500, headers: CORS_HEADERS });
  }
}
