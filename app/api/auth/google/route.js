import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getGoogleConfig,
  getGoogleRedirectUri,
  buildGoogleAuthUrl,
} from '../../../../lib/auth.js';

// GET /api/auth/google?guestUid=&next=/  -> 302 to Google
export async function GET(req) {
  const { configured } = getGoogleConfig();
  if (!configured) {
    return NextResponse.json(
      { error: 'Google sign-in is not configured yet.' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const guestUid = (searchParams.get('guestUid') || '').slice(0, 120);
  let next = searchParams.get('next') || '/';
  if (!next.startsWith('/')) next = '/';
  next = next.slice(0, 200);

  const redirectUri = getGoogleRedirectUri(req);
  if (!redirectUri) {
    return NextResponse.json({ error: 'Could not start Google sign-in.' }, { status: 500 });
  }

  const nonce =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'n_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const state = Buffer.from(JSON.stringify({ nonce, guestUid, next })).toString('base64url');

  try {
    const jar = await cookies();
    jar.set('oh_oauth_state', nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    });
  } catch {}

  return NextResponse.redirect(buildGoogleAuthUrl({ redirectUri, state }));
}
