import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '../../../../../lib/db.js';
import {
  getGoogleRedirectUri,
  exchangeGoogleCode,
  getGoogleProfile,
  createSession,
  migrateGuestData,
} from '../../../../../lib/auth.js';

function baseUrl(req) {
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

// GET /api/auth/google/callback?code=...&state=...
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state') || '';
  const oauthError = searchParams.get('error');
  const base = baseUrl(req);

  let state = {};
  try {
    state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
  } catch {}

  let nonceCookie = null;
  try {
    const jar = await cookies();
    nonceCookie = jar.get('oh_oauth_state')?.value || null;
    jar.set('oh_oauth_state', '', { path: '/', maxAge: 0 });
  } catch {}

  const fail = (msg) => {
    console.warn('[API /api/auth/google/callback]', msg);
    return NextResponse.redirect(`${base}/?auth=error`);
  };

  if (oauthError) return fail(`google said: ${oauthError}`);
  if (!code) return fail('missing code');
  if (!state.nonce || !nonceCookie || state.nonce !== nonceCookie) {
    return fail('state mismatch');
  }

  try {
    const redirectUri = getGoogleRedirectUri(req);
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const profile = await getGoogleProfile(tokens.id_token);

    let user = null;
    try {
      user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
    } catch {}
    if (!user && profile.email) {
      try {
        user = await prisma.user.findUnique({ where: { email: profile.email } });
      } catch {}
    }

    if (user) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: user.googleId || profile.googleId,
            name: user.name || profile.name,
            email: user.email || profile.email,
          },
        });
      } catch {}
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
        },
      });
    }

    await migrateGuestData(state.guestUid, user.id);
    await createSession(user.id);

    let next = typeof state.next === 'string' && state.next.startsWith('/') ? state.next : '/';
    next = next.slice(0, 200);
    const sep = next.includes('?') ? '&' : '?';
    return NextResponse.redirect(`${base}${next}${sep}auth=success`);
  } catch (err) {
    return fail(err.message);
  }
}
