'use client';
import { useState, useEffect } from 'react';
import { IconShare, IconPlus, IconX } from './Icons';

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    // Check 7-day dismissal window
    try {
      const dismissed = localStorage.getItem('oh_pwa_dismissed');
      if (dismissed) {
        const diff = Date.now() - parseInt(dismissed, 10);
        if (!isNaN(diff) && diff < 7 * 24 * 60 * 60 * 1000) {
          return;
        }
      }
    } catch {}

    // Check if Age Gate is active - wait until user enters
    const checkAgeAndShow = () => {
      try {
        const ageVerified = localStorage.getItem('oh_age_verified');
        return ageVerified === '1';
      } catch {
        return true;
      }
    };

    // 1. Android / Chromium beforeinstallprompt handler
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (checkAgeAndShow()) {
        setVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 2. iOS Safari detection (only if beforeinstallprompt is not supported)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !window.MSStream;

    let iosTimer = null;
    if (isIosDevice) {
      // Delay slightly to let page load and check if age gate passed
      iosTimer = setTimeout(() => {
        if (!deferredPrompt && checkAgeAndShow()) {
          setIsIos(true);
          setVisible(true);
        }
      }, 2500);
    }

    // Listen for age verification event to reveal banner if already queued
    const handleAgeVerified = () => {
      if (deferredPrompt || isIosDevice) {
        setVisible(true);
      }
    };
    window.addEventListener('oh_age_verified', handleAgeVerified);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('oh_age_verified', handleAgeVerified);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem('oh_pwa_dismissed', String(Date.now()));
    } catch {}
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setVisible(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('[PWA] Prompt error:', err);
    }
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Install app banner"
      className="fixed bottom-[80px] lg:bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-[#141414]/95 backdrop-blur-xl border border-[#2a2a2a] text-white p-4 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] ring-1 ring-white/10 fade-in"
    >
      <div className="flex items-start gap-3.5">
        {/* App Icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff9900] to-[#e68a00] flex-shrink-0 flex items-center justify-center shadow-lg shadow-[#ff9900]/20 font-black text-black text-xl select-none">
          OH
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="text-sm font-bold text-white leading-tight">
            {isIos ? 'Install OrangeHub on iPhone' : 'Install OrangeHub App'}
          </h3>
          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
            {isIos ? (
              <span>
                Tap the Share icon{' '}
                <span className="inline-flex items-center justify-center w-4 h-4 bg-neutral-800 rounded mx-0.5 align-middle text-[#ff9900]">
                  <IconShare size={12} />
                </span>{' '}
                below, then select{' '}
                <strong className="text-white">Add to Home Screen</strong>{' '}
                <span className="inline-flex items-center justify-center w-4 h-4 bg-neutral-800 rounded mx-0.5 align-middle text-[#ff9900]">
                  <IconPlus size={12} />
                </span>{' '}
                for full-screen app mode.
              </span>
            ) : (
              '1080p Full HD video streaming with zero ads & instant 1-tap home screen access.'
            )}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3.5">
            {!isIos ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-4 py-2 rounded-xl bg-[#ff9900] hover:bg-[#ffa826] active:bg-[#e68a00] text-black font-extrabold text-xs shadow-md shadow-[#ff9900]/25 transition-all cursor-pointer"
              >
                Install
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleDismiss}
              className={`px-3 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer ${
                isIos ? 'bg-neutral-800/80 hover:bg-neutral-700 text-white font-bold px-4' : 'hover:bg-white/5'
              }`}
            >
              {isIos ? 'Got it' : 'Dismiss'}
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Dismiss install banner"
        >
          <IconX size={15} />
        </button>
      </div>
    </aside>
  );
}
