import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
  return { id: u.id, email: u.email, name: u.name || null, phone: u.phone || null };
}

// ---------- Google OAuth ----------

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

export function getGoogleRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  try {
    const url = new URL(req.url);
    const proto =
      req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'https';
    return `${proto}://${url.host}/api/auth/google/callback`;
  } catch {
    return '';
  }
}

export function buildGoogleAuthUrl({ redirectUri, state }) {
  const { clientId } = getGoogleConfig();
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeGoogleCode(code, redirectUri) {
  const { clientId, clientSecret } = getGoogleConfig();
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id_token) {
    throw new Error(j.error_description || 'Google sign-in failed. Try again.');
  }
  return j;
}

export async function getGoogleProfile(idToken) {
  const r = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  const j = await r.json().catch(() => ({}));
  const { clientId } = getGoogleConfig();
  if (!r.ok || !j.sub || j.aud !== clientId) {
    throw new Error('Google sign-in verification failed.');
  }
  return {
    googleId: String(j.sub),
    email: j.email ? String(j.email).trim().toLowerCase() : null,
    name: j.name ? String(j.name).slice(0, 40) : null,
  };
}

// ---------- Firebase phone ID token verification ----------

let certCache = null;

async function getFirebaseCerts() {
  if (certCache && Date.now() - certCache.fetchedAt < 3600 * 1000) return certCache.certs;
  const r = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!r.ok) throw new Error('Could not verify login. Try again.');
  const certs = await r.json();
  certCache = { certs, fetchedAt: Date.now() };
  return certs;
}

export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') throw new Error('Missing login token.');
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orangehub-29955';
  const certs = await getFirebaseCerts();
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded && decoded.header && decoded.header.kid;
  const cert = kid && certs[kid];
  if (!cert) throw new Error('Could not verify login. Try again.');
  let payload;
  try {
    payload = jwt.verify(idToken, cert, { algorithms: ['RS256'] });
  } catch {
    throw new Error('Login expired. Please try again.');
  }
  if (payload.aud !== projectId) throw new Error('Could not verify login. Try again.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Could not verify login. Try again.');
  }
  return { phone: payload.phone_number || null, firebaseUid: payload.sub || null };
}
