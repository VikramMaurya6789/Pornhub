import { NextResponse } from 'next/server';
import prisma from '../../../../lib/db.js';
import {
  verifyFirebaseIdToken,
  createSession,
  rateLimit,
  getClientIp,
  migrateGuestData,
  publicUser,
} from '../../../../lib/auth.js';

// POST /api/auth/phone  { idToken, guestUid? }
// Verifies the Firebase phone-auth ID token, finds or creates the user by
// phone number (E.164), migrates guest data, and starts a session.
export async function POST(req) {
  const ip = getClientIp(req);
  if (!rateLimit(`phone:${ip}`, 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const idToken = body.idToken;
  const guestUid = typeof body.guestUid === 'string' ? body.guestUid.trim().slice(0, 120) : null;

  let phone;
  try {
    ({ phone } = await verifyFirebaseIdToken(idToken));
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Verification failed.' }, { status: 401 });
  }
  if (!phone) {
    return NextResponse.json({ error: 'No phone number found. Try again.' }, { status: 400 });
  }

  try {
    let user = null;
    try {
      user = await prisma.user.findUnique({ where: { phone } });
    } catch {}
    if (!user) {
      user = await prisma.user.create({ data: { phone } });
    }

    await migrateGuestData(guestUid, user.id);
    await createSession(user.id);

    return NextResponse.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.warn('[API /api/auth/phone] error:', err.message);
    return NextResponse.json({ error: 'Could not sign in. Try again.' }, { status: 500 });
  }
}
