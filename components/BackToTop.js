'use client';
import { useState, useEffect } from 'react';
import { IconArrowUp } from './Icons';

/**
 * Floating back-to-top button for long listing pages.
 * Appears after scrolling ~600px, smooth-scrolls to top on tap.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setVisible(window.scrollY > 600);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      title="Back to top"
      className="fixed right-6 z-40 w-11 h-11 rounded-full bg-[#ff9900] text-black shadow-xl shadow-black/40 flex items-center justify-center hover:bg-[#e68a00] active:scale-90 transition-all cursor-pointer fade-in bottom-[max(5.5rem,env(safe-area-inset-bottom))] lg:bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <IconArrowUp size={20} />
    </button>
  );
}
