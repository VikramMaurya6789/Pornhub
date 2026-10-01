'use client';

/**
 * Cookie and local storage consent management for OrangeHub.
 * Standard consent object shape: { essential: true, functional: boolean, analytics: boolean, ts: number }
 */

export function getConsent() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('oh_cookie_consent');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isFunctionalAllowed() {
  const consent = getConsent();
  if (!consent) return true; // Default to allowed before user choice
  return consent.functional !== false;
}

export function hasRejectedFunctional() {
  const consent = getConsent();
  return consent !== null && consent.functional === false;
}

export function isAnalyticsAllowed() {
  const consent = getConsent();
  if (!consent) return false;
  return Boolean(consent.analytics);
}

export function openCookiePreferences() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open_cookie_consent'));
  }
}

export function saveConsent({ functional = true, analytics = false }) {
  if (typeof window === 'undefined') return;
  const data = {
    essential: true,
    functional: Boolean(functional),
    analytics: Boolean(analytics),
    ts: Date.now(),
  };
  try {
    localStorage.setItem('oh_cookie_consent', JSON.stringify(data));
    if (!data.functional) {
      localStorage.removeItem('oh_uid');
    }
  } catch {}
  window.dispatchEvent(new CustomEvent('oh_consent_changed', { detail: data }));
  return data;
}
