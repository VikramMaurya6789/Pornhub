import { NextResponse } from 'next/server';

const rateLimitMap = new Map(); // uid -> timestamp
const commentsStore = new Map(); // vkey -> Array of comments

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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const vkey = searchParams.get('vkey');

    if (!vkey) {
      return NextResponse.json({ error: 'vkey required' }, { status: 400, headers: CORS_HEADERS });
    }

    const list = commentsStore.get(vkey) || [];
    return NextResponse.json(
      { comments: list },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
          ...CORS_HEADERS,
        },
      }
    );
  } catch (err) {
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
    const rawText = String(body.text || body.message || '').trim();
    const rawAuthor = String(body.author || body.user || '').trim();

    if (!vkey) {
      return NextResponse.json({ error: 'vkey is required' }, { status: 400, headers: CORS_HEADERS });
    }

    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400, headers: CORS_HEADERS });
    }

    if (!rawText) {
      return NextResponse.json({ error: 'Comment text cannot be empty' }, { status: 400, headers: CORS_HEADERS });
    }

    if (rawText.length > 500) {
      return NextResponse.json({ error: 'Comment must be 500 characters or less' }, { status: 400, headers: CORS_HEADERS });
    }

    // Rate limit: 1 comment per 30 seconds per uid
    const now = Date.now();
    const lastPost = rateLimitMap.get(uid);
    if (lastPost && now - lastPost < 30000) {
      const waitSec = Math.ceil((30000 - (now - lastPost)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSec}s before posting another comment` },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    rateLimitMap.set(uid, now);

    // Clean up old rate limits
    if (rateLimitMap.size > 10000) {
      for (const [k, ts] of rateLimitMap.entries()) {
        if (now - ts > 60000) rateLimitMap.delete(k);
      }
    }

    const sanitizedText = escapeHtml(rawText);
    const sanitizedAuthor = escapeHtml(rawAuthor.slice(0, 40)) || 'Anonymous';

    const newComment = {
      id: `c_${now}_${Math.random().toString(36).substring(2, 7)}`,
      vkey,
      uid,
      user: sanitizedAuthor,
      avatar: `/api/avatar?name=${encodeURIComponent(sanitizedAuthor)}`,
      date: 'Just now',
      message: sanitizedText,
      upvotes: 0,
      createdAt: new Date().toISOString(),
    };

    const existing = commentsStore.get(vkey) || [];
    const updated = [newComment, ...existing].slice(0, 100); // newest first, cap at 100 per video
    commentsStore.set(vkey, updated);

    return NextResponse.json(
      { success: true, comment: newComment },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[API /api/comments] Error:', err);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500, headers: CORS_HEADERS });
  }
}
