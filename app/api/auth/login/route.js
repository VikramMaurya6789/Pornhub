import { NextResponse } from 'next/server';
import prisma from '../../../../lib/db.js';
import {
  verifyPassword,
  createSession,
  normalizeEmail,
  rateLimit,
  getClientIp,
  migrateGuestData,
  publicUser,
} from '../../../../lib/auth.js';

export async function POST(req) {
  const ip = getClientIp(req);
  if (!rateLimit(`login:${ip}`, 12, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const password = body.password;
  const guestUid = typeof body.guestUid === 'string' ? body.guestUid.trim().slice(0, 120) : null;

  if (!email || !password) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    // Same message for unknown email vs wrong password (no account enumeration).
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
    }

    await migrateGuestData(guestUid, user.id);
    await createSession(user.id);

    return NextResponse.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.warn('[API /api/auth/login] error:', err.message);
    return NextResponse.json({ error: 'Could not sign in. Try again.' }, { status: 500 });
  }
}
