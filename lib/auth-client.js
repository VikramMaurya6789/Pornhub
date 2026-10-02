'use client';

export const AUTH_CHANGED_EVENT = 'oh_auth_changed';

// undefined = not loaded yet, null = logged out, object = logged in
let cachedUser = undefined;
let inflight = null;

function emit() {
  try {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
  } catch {}
}

export function getCachedUser() {
  return cachedUser;
}

export function setCachedUser(user) {
  cachedUser = user || null;
  emit();
}

export async function fetchMe() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      cachedUser = j && j.user ? j.user : null;
    } catch {
      cachedUser = null;
    }
    emit();
    return cachedUser;
  })();
  try {
    await inflight;
  } finally {
    inflight = null;
  }
  return cachedUser;
}

export function openAuthModal(mode = 'signin') {
  try {
    const next = window.location.pathname + window.location.search;
    const q = new URLSearchParams();
    if (mode === 'register') q.set('mode', 'register');
    if (next && !next.startsWith('/login')) q.set('next', next);
    window.location.href = '/login' + (q.toString() ? '?' + q.toString() : '');
  } catch {}
}

export async function signOut() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {}
  cachedUser = null;
  emit();
}

export function subscribeAuth(fn) {
  window.addEventListener(AUTH_CHANGED_EVENT, fn);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, fn);
}
