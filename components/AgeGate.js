'use client';
import { useEffect, useState } from 'react';
import { Logo } from './Header';
import { IconAlert, IconCheck, IconX } from './Icons';

export default function AgeGate() {
  const [dismissed, setDismissed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    try {
      const localVerified =
        localStorage.getItem('oh_age_verified') === '1' ||
        localStorage.getItem('oh_age_ok') === '1';
      const sessionVerified =
        typeof window !== 'undefined' && sessionStorage.getItem('oh_age_session') === '1';
      const cookieVerified =
        typeof document !== 'undefined' &&
        document.cookie
          .split(';')
          .some((c) => c.trim().startsWith('oh_age_verified=1') || c.trim().startsWith('oh_age_ok=1'));

      if (localVerified || sessionVerified || cookieVerified) {
        document.documentElement.classList.add('oh-age-verified');
        setDismissed(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!dismissed && !isExiting) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [dismissed, isExiting]);

  if (dismissed) return null;

  const handleEnter = () => {
    try {
      if (rememberMe) {
        // Remember for ~1 year across visits
        localStorage.setItem('oh_age_verified', '1');
        localStorage.setItem('oh_age_ok', '1');
        document.cookie = 'oh_age_verified=1; path=/; max-age=31536000; SameSite=Lax';
        document.cookie = 'oh_age_ok=1; path=/; max-age=31536000; SameSite=Lax';
      } else {
        // Session only: gate shows again on next visit / new tab session
        try { sessionStorage.setItem('oh_age_session', '1'); } catch {}
        try {
          localStorage.removeItem('oh_age_verified');
          localStorage.removeItem('oh_age_ok');
        } catch {}
      }
      document.documentElement.classList.add('oh-age-verified');
    } catch {}

    setIsExiting(true);
    setTimeout(() => {
      setDismissed(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('oh_age_verified'));
        window.dispatchEvent(new CustomEvent('oh_age_confirmed'));
      }
    }, 280);
  };

  const handleExit = () => {
    if (typeof window !== 'undefined') {
      window.location.href = 'https://www.google.com';
    }
  };

  return (
    <div
      id="oh-age-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className={`fixed inset-0 z-[100000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300 pointer-events-auto select-none ${
        isExiting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <div className="bg-[#121212] border border-[#2a2a2a] ring-1 ring-white/10 rounded-2xl max-w-md w-full p-6 sm:p-8 text-center shadow-2xl transition-transform duration-300 motion-reduce:transition-none">
        {/* Header with Logo */}
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        {/* 18+ Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#ff9900]/15 border border-[#ff9900]/40 text-[#ff9900] font-black text-xs uppercase tracking-wider mb-4">
          <span className="w-2 h-2 rounded-full bg-[#ff9900] animate-pulse" />
          <span>18+ Age Verification</span>
        </div>

        {/* Title */}
        <h2 id="age-gate-title" className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
          Adults Only (18+)
        </h2>

        {/* Warning Copy */}
        <p className="text-xs sm:text-sm text-neutral-400 mb-6 leading-relaxed">
          This website contains sexually explicit material intended solely for adults.
          You must be at least 18 years of age (or the legal age of majority in your jurisdiction) to view this content.
        </p>

        {/* Remember me */}
        <label className="flex items-center justify-center gap-2.5 mb-5 cursor-pointer select-none group">
          <button
            type="button"
            role="checkbox"
            aria-checked={rememberMe}
            onClick={() => setRememberMe((v) => !v)}
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
              rememberMe
                ? 'bg-[#ff9900] border-[#ff9900] shadow-sm shadow-[#ff9900]/40'
                : 'border-[#3a3a3a] bg-white/5 group-hover:border-neutral-500'
            }`}
          >
            {rememberMe && <IconCheck size={14} className="text-black stroke-[3.5]" />}
          </button>
          <span
            className="text-xs sm:text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors"
            onClick={() => setRememberMe((v) => !v)}
          >
            Remember me on this device
          </span>
        </label>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleEnter}
            className="w-full py-3.5 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] active:scale-[0.98] text-black font-extrabold text-sm sm:text-base transition-all shadow-lg shadow-[#ff9900]/25 cursor-pointer flex items-center justify-center gap-2"
          >
            <IconCheck size={18} className="stroke-[3]" />
            <span>I am 18 or older — Enter</span>
          </button>

          <a
            href="https://www.google.com"
            rel="noopener noreferrer"
            className="w-full py-3 rounded-xl border border-[#2c2c2c] hover:border-neutral-500 hover:bg-white/5 active:scale-[0.98] text-neutral-400 hover:text-white font-medium text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <IconX size={16} />
            <span>Exit</span>
          </a>
        </div>
      </div>
    </div>
  );
}
