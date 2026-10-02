'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconCookie, IconCheck, IconX, IconLock } from './Icons';
import { getConsent, saveConsent } from '../lib/consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // Toggle states for customization
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const checkState = () => {
      try {
        const consent = localStorage.getItem('oh_cookie_consent');
        const localAge =
          localStorage.getItem('oh_age_verified') === '1' ||
          localStorage.getItem('oh_age_ok') === '1';
        const cookieAge =
          typeof document !== 'undefined' &&
          document.cookie
            .split(';')
            .some((c) => c.trim().startsWith('oh_age_verified=1') || c.trim().startsWith('oh_age_ok=1'));
        const ageConfirmed = localAge || cookieAge;

        // Show ONLY if no consent recorded AND age gate has already been confirmed
        if (!consent && ageConfirmed) {
          setVisible(true);
        }
      } catch {}
    };

    checkState();

    // Listen for age gate confirmation so cookie banner slides up immediately after
    const handleAgeConfirmed = () => {
      const consent = localStorage.getItem('oh_cookie_consent');
      if (!consent) {
        setTimeout(() => setVisible(true), 350);
      }
    };

    // Listen for footer "Cookie Settings" click to re-open modal
    const handleOpenSettings = () => {
      const current = getConsent();
      if (current) {
        setFunctional(current.functional !== false);
        setAnalytics(Boolean(current.analytics));
      }
      setIsExiting(false);
      setVisible(true);
      setShowPreferences(true);
    };

    window.addEventListener('oh_age_verified', handleAgeConfirmed);
    window.addEventListener('oh_age_confirmed', handleAgeConfirmed);
    window.addEventListener('open_cookie_consent', handleOpenSettings);

    return () => {
      window.removeEventListener('oh_age_verified', handleAgeConfirmed);
      window.removeEventListener('oh_age_confirmed', handleAgeConfirmed);
      window.removeEventListener('open_cookie_consent', handleOpenSettings);
    };
  }, []);

  const closeWithAnimation = (callback) => {
    setIsExiting(true);
    setTimeout(() => {
      setVisible(false);
      setIsExiting(false);
      setShowPreferences(false);
      if (callback) callback();
    }, 280);
  };

  const handleAcceptAll = () => {
    saveConsent({ functional: true, analytics: true });
    closeWithAnimation();
  };

  const handleRejectNonEssential = () => {
    saveConsent({ functional: false, analytics: false });
    closeWithAnimation();
  };

  const handleSaveChoices = () => {
    saveConsent({ functional, analytics });
    closeWithAnimation();
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed left-0 right-0 p-3 z-50 bottom-[64px] sm:p-0 sm:bottom-[80px] lg:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-3xl sm:w-[calc(100%-2rem)] ${
        isExiting ? 'cookie-slide-down' : 'cookie-slide-up'
      }`}
      role="region"
      aria-label="Cookie consent banner"
    >
      <div className="bg-[#141414] border border-[#2a2a2a] ring-1 ring-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md">
        {!showPreferences ? (
          /* Main Banner View */
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-[#ff9900]/15 text-[#ff9900] flex items-center justify-center shrink-0 mt-0.5">
                <IconCookie size={22} />
              </div>
              <div className="text-xs sm:text-[13px] text-neutral-300 leading-relaxed">
                <p>
                  We use cookies and local storage to keep the site working (age check, favorites, continue watching) and to understand usage. Thumbnails and streams are proxied — we don&apos;t track you across sites.{' '}
                  <Link href="/privacy" className="text-[#ff9900] hover:underline font-semibold ml-1 inline-flex items-center">
                    Learn more
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0 justify-end pt-2 md:pt-0 border-t md:border-t-0 border-[#222]">
              <button
                type="button"
                onClick={() => setShowPreferences(true)}
                className="px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white underline transition-colors cursor-pointer"
              >
                Customize
              </button>
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-[#333] hover:border-neutral-500 text-neutral-200 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] transition-all cursor-pointer"
              >
                Reject non-essential
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black shadow-lg shadow-[#ff9900]/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          /* Preferences Modal View */
          <div className="fade-in space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <IconCookie size={18} className="text-[#ff9900]" />
                <h3 className="font-bold text-sm sm:text-base text-white">Cookie &amp; Storage Preferences</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-[#222] transition-colors cursor-pointer"
                aria-label="Back to banner"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {/* Row 1: Essential */}
              <div className="p-3.5 rounded-xl bg-[#111] border border-[#222] flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-white">Essential Cookies &amp; Storage</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ff9900]/15 text-[#ff9900] border border-[#ff9900]/30">
                      Always Active
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-normal">
                    Required for 18+ age verification, secure token proxying, and core video playback. Cannot be disabled.
                  </p>
                </div>
                <div className="w-10 h-6 rounded-full bg-[#ff9900]/40 flex items-center px-1 shrink-0 opacity-80 cursor-not-allowed">
                  <div className="w-4 h-4 rounded-full bg-[#ff9900] shadow flex items-center justify-center translate-x-4 transition-transform">
                    <IconLock size={10} className="text-black" />
                  </div>
                </div>
              </div>

              {/* Row 2: Functional */}
              <div
                onClick={() => setFunctional(!functional)}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                  functional ? 'bg-[#181818] border-[#ff9900]/40' : 'bg-[#111] border-[#222]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs sm:text-sm text-white">Functional (Favorites &amp; History)</span>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-normal">
                    Enables hearting videos, continue-watching progress, and watch history using an anonymous client-side ID (<code>oh_uid</code>).
                  </p>
                </div>
                <div
                  className={`w-11 h-6 rounded-full flex items-center px-1 shrink-0 transition-colors ${
                    functional ? 'bg-[#ff9900]' : 'bg-[#333]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-black shadow transition-transform ${
                      functional ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Row 3: Analytics */}
              <div
                onClick={() => setAnalytics(!analytics)}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                  analytics ? 'bg-[#181818] border-[#ff9900]/40' : 'bg-[#111] border-[#222]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs sm:text-sm text-white">Anonymous Analytics</span>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-normal">
                    Helps us understand aggregated viewing metrics and performance. Reserved for future analytics (zero cross-site tracking).
                  </p>
                </div>
                <div
                  className={`w-11 h-6 rounded-full flex items-center px-1 shrink-0 transition-colors ${
                    analytics ? 'bg-[#ff9900]' : 'bg-[#333]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-black shadow transition-transform ${
                      analytics ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222]">
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#222] hover:bg-[#333] text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSaveChoices}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black shadow-lg shadow-[#ff9900]/20 transition-all cursor-pointer"
              >
                Save choices
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
