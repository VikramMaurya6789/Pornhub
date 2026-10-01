'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({ error, reset }) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error('[OrangeHub Global Error Boundary]:', error?.message || error, error?.digest || '');
  }, [error]);

  const handleRetry = () => {
    setRetrying(true);
    try {
      if (typeof reset === 'function') {
        reset();
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
    setTimeout(() => {
      setRetrying(false);
    }, 1500);
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#ff9900]/15 border border-[#ff9900]/40 flex items-center justify-center text-[#ff9900] mb-6 shadow-2xl">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-black text-white mb-2">
        Unable to Load Content
      </h2>
      <p className="text-sm text-neutral-400 max-w-md mb-8 leading-relaxed">
        {error?.message && !error.message.includes('digest')
          ? error.message
          : 'We encountered a temporary connection issue while loading this page. Click below to reconnect or return to home.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="px-6 py-2.5 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold text-sm transition-all shadow-lg shadow-[#ff9900]/20 cursor-pointer disabled:opacity-50"
        >
          {retrying ? 'Reconnecting...' : 'Try Again'}
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#282828] text-neutral-200 hover:text-white border border-[#2a2a2a] font-semibold text-sm transition-colors"
        >
          Return Home
        </Link>
        <Link
          href="/list/hottest"
          className="px-6 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#282828] text-neutral-200 hover:text-white border border-[#2a2a2a] font-semibold text-sm transition-colors"
        >
          Browse Hottest
        </Link>
      </div>
    </div>
  );
}
