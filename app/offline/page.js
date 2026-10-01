'use client';
import Link from 'next/link';
import { IconAlert, IconRefresh } from '../../components/Icons';

export default function OfflinePage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="p-4 rounded-2xl bg-[#1c1408] border border-[#ff9900]/30 text-[#ff9900] mb-6">
        <IconAlert size={48} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
        You are currently offline
      </h1>
      <p className="text-sm text-neutral-400 max-w-md mb-8 leading-relaxed">
        It looks like your internet connection was interrupted. Check your network or Wi-Fi settings and try again.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ff9900] hover:bg-[#ffa826] text-black font-bold text-sm transition-colors cursor-pointer shadow-lg shadow-[#ff9900]/20 active:scale-95"
        >
          <IconRefresh size={16} />
          <span>Reload Page</span>
        </button>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] text-white font-semibold text-sm border border-white/10 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
