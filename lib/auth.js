import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import prisma from './db.js';

export const SESSION_COOKIE = 'oh_session';
const SESSION_DAYS = 30;

// ---------- password ----------

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  try {
    if (!password || !hash) return false;
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// ---------- validation ----------

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ---------- sessions (opaque token in httpOnly cookie) ----------

export async function createSession(userId) {
  const token =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 's_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  try {
    await prisma.session.create({ data: { id: token, userId, expiresAt } });
  } catch {
    return null;
  }
  try {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_DAYS * 86400,
    });
  } catch {}
  return token;
}

export async function getSessionUser() {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const s = await prisma.session.findUnique({
      where: { id: token },
      include: { user: true },
    });
    if (!s || !s.user) return null;
    if (s.expiresAt < new Date()) {
      try {
        await prisma.session.delete({ where: { id: token } });
      } catch {}
      return null;
    }
    return { id: s.user.id, email: s.user.email, name: s.user.name };
  } catch {
    return null;
  }
}

export async function destroySession() {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
      try {
        await prisma.session.delete({ where: { id: token } });
      } catch {}
    }
    jar.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  } catch {}
}

// Resolve the user id for data APIs: logged-in account wins, otherwise the
// anonymous device uid the client sent. Never throws.
export async function getEffectiveUid(fallbackUid) {
  try {
    const user = await getSessionUser();
    if (user) return user.id;
  } catch {}
  return fallbackUid && String(fallbackUid).trim() ? String(fallbackUid).trim() : null;
}

// ---------- rate limiting (in-memory, per instance) ----------

const rlMap = new Map(); // key -> { count, resetAt }

export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let e = rlMap.get(key);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + windowMs };
    rlMap.set(key, e);
  }
  e.count += 1;
  if (rlMap.size > 5000) {
    for (const [k, v] of rlMap.entries()) {
      if (v.resetAt <= now) rlMap.delete(k);
      if (rlMap.size <= 4000) break;
    }
  }
  return e.count <= max;
}

export function getClientIp(req) {
  try {
    const h = req.headers;
    const xff = h.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    const xr = h.get('x-real-ip');
    if (xr) return xr.trim();
  } catch {}
  return 'unknown';
}

// ---------- guest -> account data migration ----------

export async function migrateGuestData(guestUid, userId) {
  if (!guestUid || !userId || guestUid === userId) return;
  try {
    const favs = await prisma.favorite.findMany({ where: { userId: guestUid } });
    for (const f of favs) {
      try {
        await prisma.favorite.upsert({
          where: { userId_vkey: { userId, vkey: f.vkey } },
          update: {},
          create: { userId, vkey: f.vkey, title: f.title, thumbnail: f.thumbnail },
        });
      } catch {}
    }
  } catch {}
  try {
    const hist = await prisma.watchHistory.findMany({ where: { userId: guestUid } });
    for (const h of hist) {
      try {
        await prisma.watchHistory.upsert({
          where: { userId_vkey: { userId, vkey: h.vkey } },
          update: {},
          create: {
            userId,
            vkey: h.vkey,
            title: h.title,
            thumbnail: h.thumbnail,
            durationSec: h.durationSec,
            progressSec: h.progressSec,
          },
        });
      } catch {}
    }
  } catch {}
  try {
    const pls = await prisma.playlist.findMany({
      where: { userId: guestUid },
      include: { items: true },
    });
    for (const p of pls) {
      try {
        const np = await prisma.playlist.create({
          data: { userId, name: p.name, isPublic: p.isPublic },
        });
        for (const it of p.items || []) {
          try {
            await prisma.playlistItem.create({
              data: {
                playlistId: np.id,
                vkey: it.vkey,
                title: it.title,
                thumbnail: it.thumbnail,
                position: it.position,
              },
            });
          } catch {}
        }
      } catch {}
    }
  } catch {}
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name || null };
}
