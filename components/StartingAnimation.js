'use client';
import { useState, useEffect } from 'react';

/**
 * Halix.cloud-inspired Starting Intro Animation.
 * Optimized for desktop and all mobile screen sizes (no overflow, perfectly centered, 100dvh).
 */
export default function StartingAnimation() {
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('oh_intro_shown') === '1') {
        return;
      }
      sessionStorage.setItem('oh_intro_shown', '1');
    } catch {}

    setMounted(true);

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 280);

    const doneTimer = setTimeout(() => {
      setMounted(false);
    }, 450);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (!mounted) return null;

  const orangeLetters = ['O', 'R', 'A', 'N', 'G', 'E'];
  const hubLetters = ['H', 'U', 'B'];

  return (
    <div
      aria-hidden="true"
      onClick={() => setMounted(false)}
      className={`fixed inset-0 w-full h-[100dvh] min-h-[100dvh] z-[99999] flex items-center justify-center bg-[#070709] overflow-hidden select-none cursor-pointer transition-opacity duration-300 ${
        isExiting
          ? 'opacity-0 blur-[8px] pointer-events-none'
          : 'opacity-100 blur-0'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Halix-style deep atmospheric ambient radial background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#ff9900]/16 via-[#08080a] to-[#040405] pointer-events-none" />

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Responsive centered inner container */}
      <div
        className={`flex flex-col items-center justify-center gap-5 sm:gap-7 relative z-10 px-4 w-full max-w-xs sm:max-w-sm transition-transform duration-800 ${
          isExiting ? 'scale-105' : 'scale-100'
        }`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Glowing Logo Icon */}
        <div className="relative animate-logo-in shrink-0">
          {/* Pulsating background glow aura */}
          <div className="absolute inset-0 bg-[#ff9900] blur-2xl sm:blur-3xl opacity-35 animate-pulse" />

          {/* Logo Badge Icon */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(255,153,0,0.55)] flex items-center justify-center z-10 ring-2 ring-[#ff9900]/60 bg-[#0a0a0c]">
            <img src="/icon-192.png" alt="OrangeHub" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Text Letters Stagger + Laser Loading Bar */}
        <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 w-full">
          {/* Staggered Letters: ORANGE in silver/white + HUB in glowing orange (Strictly nowrap & responsive) */}
          <div className="flex items-center justify-center whitespace-nowrap select-none">
            <div className="flex items-center space-x-[2px] sm:space-x-1">
              {orangeLetters.map((char, idx) => (
                <span
                  key={`o_${idx}`}
                  className="animate-letter text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-100 to-white/60 tracking-tight sm:tracking-wider inline-block"
                  style={{
                    animationDelay: `${0.25 + idx * 0.07}s`,
                  }}
                >
                  {char}
                </span>
              ))}
            </div>

            <div className="flex items-center space-x-[2px] sm:space-x-1 ml-1 sm:ml-2">
              {hubLetters.map((char, idx) => (
                <span
                  key={`h_${idx}`}
                  className="animate-letter text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#ffbb33] via-[#ff9900] to-[#e68a00] tracking-tight sm:tracking-wider inline-block drop-shadow-[0_0_12px_rgba(255,153,0,0.6)]"
                  style={{
                    animationDelay: `${0.25 + (orangeLetters.length + idx) * 0.07}s`,
                  }}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          {/* Halix Glowing Progress Line with Sweeping Laser Highlight */}
          <div className="w-36 sm:w-56 h-[2px] bg-gradient-to-r from-transparent via-[#ff9900] to-transparent relative overflow-hidden rounded-full animate-line-expand shrink-0">
            <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white to-transparent animate-laser" />
          </div>

          {/* Subtle Tagline */}
          <p
            className="text-[9px] sm:text-[10px] font-bold tracking-[0.25em] sm:tracking-[0.3em] text-neutral-400 uppercase animate-letter whitespace-nowrap"
            style={{ animationDelay: '0.85s' }}
          >
            PERFORMANCE FIRST
          </p>
        </div>
      </div>
    </div>
  );
}
