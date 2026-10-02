import { NextResponse } from 'next/server';
import prisma from '../../../../lib/db.js';
import {
  hashPassword,
  createSession,
  isValidEmail,
  normalizeEmail,
  rateLimit,
  getClientIp,
  migrateGuestData,
  publicUser,
} from '../../../../lib/auth.js';

export async function POST(req) {
  const ip = getClientIp(req);
  if (!rateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
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
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
  const guestUid = typeof body.guestUid === 'string' ? body.guestUid.trim().slice(0, 120) : null;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: 'Password is too long.' }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Try signing in.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, name: name || null, passwordHash },
    });

    await migrateGuestData(guestUid, user.id);
    await createSession(user.id);

    return NextResponse.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.warn('[API /api/auth/register] error:', err.message);
    return NextResponse.json({ error: 'Could not create account. Try again.' }, { status: 500 });
  }
}
