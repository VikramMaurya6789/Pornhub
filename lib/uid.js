'use client';
import { isFunctionalAllowed, hasRejectedFunctional } from './consent';

/**
 * Returns or generates a persistent anonymous user UUID stored as oh_uid in localStorage.
 * Degrades gracefully:
 * - Generates exactly once (crypto.randomUUID).
 * - Persisted to localStorage ONLY under Functional consent.
 * - Never throws if localStorage is unavailable, blocked, or in private browsing.
 * - Returns empty string if user rejected functional cookies.
 */
let cachedUid = null;

export function getUserId() {
  if (typeof window === 'undefined') return '';

  if (hasRejectedFunctional()) {
    cachedUid = null;
    return '';
  }

  if (cachedUid) return cachedUid;

  try {
    let uid = null;
    try {
      if (typeof localStorage !== 'undefined') {
        uid = localStorage.getItem('oh_uid');
      }
    } catch {}

    if (uid && typeof uid === 'string') {
      cachedUid = uid;
      return uid;
    }

    // Only persist if functional cookies are permitted
    if (isFunctionalAllowed()) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        uid = crypto.randomUUID();
      } else {
        uid = 'u_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
      }

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('oh_uid', uid);
        }
      } catch {}

      cachedUid = uid;
      return uid;
    }

    return '';
  } catch {
    return '';
  }
}

// Reset cached ID if consent changes
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('oh_consent_changed', (e) => {
      if (e?.detail?.functional === false) {
        cachedUid = null;
      }
    });
  } catch {}
}
