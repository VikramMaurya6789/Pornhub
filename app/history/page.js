'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LibraryNav from '../../components/LibraryNav';
import { IconClock, IconTrash, IconPlay, IconX, IconEye } from '../../components/Icons';
import { getUserId } from '../../lib/uid';
import { hasRejectedFunctional } from '../../lib/consent';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadHistory = () => {
    if (hasRejectedFunctional()) {
      setHistory([]);
      setLoaded(true);
      return;
    }

    const uid = getUserId();
    if (uid) {
      fetch(`/api/history?uid=${encodeURIComponent(uid)}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.history) && data.history.length > 0) {
            setHistory(data.history);
            try {
              localStorage.setItem('oh_history', JSON.stringify(data.history));
            } catch {}
          } else {
            try {
              const raw = localStorage.getItem('oh_history');
              if (raw) setHistory(JSON.parse(raw));
            } catch {}
          }
        })
        .catch(() => {
          try {
            const raw = localStorage.getItem('oh_history');
            if (raw) setHistory(JSON.parse(raw));
          } catch {}
        })
        .finally(() => setLoaded(true));
    } else {
      try {
        const raw = localStorage.getItem('oh_history');
        if (raw) setHistory(JSON.parse(raw));
      } catch {}
      setLoaded(true);
    }
  };

  useEffect(() => {
    loadHistory();
    window.addEventListener('oh_consent_changed', loadHistory);
    return () => window.removeEventListener('oh_consent_changed', loadHistory);
  }, []);

  const handleClearAll = () => {
    setClearing(true);
    setHistory([]);
    try {
      localStorage.removeItem('oh_history');
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('oh_history_cleared'));
    } catch {}

    const uid = getUserId();
    if (uid) {
      fetch(`/api/history?uid=${encodeURIComponent(uid)}&vkey=all`, { method: 'DELETE' })
        .catch(() => {})
        .finally(() => setClearing(false));
    } else {
      setClearing(false);
    }
  };

  const handleRemoveItem = async (vkey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = history.filter((item) => item.vkey !== vkey);
    setHistory(updated);
    try {
      localStorage.setItem('oh_history', JSON.stringify(updated));
      const uid = getUserId();
      if (uid) {
        await fetch(`/api/history?uid=${encodeURIComponent(uid)}&vkey=${encodeURIComponent(vkey)}`, {
          method: 'DELETE',
        });
      }
    } catch {}
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <LibraryNav />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
            <span className="w-11 h-11 rounded-xl bg-[#ff9900]/10 border border-[#ff9900]/20 flex items-center justify-center text-[#ff9900]">
              <IconClock size={22} />
            </span>
            <span>Watch History</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {history.length} {history.length === 1 ? 'video' : 'videos'} watched
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/40 border border-red-800/50 hover:bg-red-900/60 text-red-400 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <IconTrash size={15} />
            <span>{clearing ? 'Clearing...' : 'Clear Watch History'}</span>
          </button>
        )}
      </div>

      {!loaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video bg-[#181818] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 px-4 bg-[#121212] border border-[#222] rounded-3xl max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-[#1c1c1c] text-[#ff9900] flex items-center justify-center mx-auto mb-4">
            <IconClock size={32} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No watch history yet</h3>
          <p className="text-sm text-neutral-400 mb-6">
            Videos you watch will appear here so you can easily resume or re-watch them anytime.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ff9900] text-black font-bold text-sm shadow-lg shadow-[#ff9900]/20 hover:bg-[#ffa826] transition-colors"
          >
            <IconPlay size={16} />
            <span>Explore Videos</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6">
          {history.map((item) => {
            const progressPercent = item.durationSec && item.progressSec
              ? Math.min(100, Math.round((item.progressSec / item.durationSec) * 100))
              : 0;

            return (
              <div key={item.vkey} className="group relative block bg-[#141414] border border-[#222] rounded-2xl overflow-hidden hover:border-[#ff9900]/60 transition-all">
                <Link href={`/watch/${item.vkey}`} className="block relative aspect-video bg-black overflow-hidden">
                  <img
                    src={item.thumbnail || '/og-image.jpg'}
                    alt={item.title || 'Video'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Progress bar */}
                  {progressPercent > 0 && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                      <div className="h-full bg-[#ff9900]" style={{ width: `${progressPercent}%` }} />
                    </div>
                  )}

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveItem(item.vkey, e)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 hover:bg-red-600 text-neutral-300 hover:text-white flex items-center justify-center transition-all z-20 cursor-pointer shadow-md"
                    title="Remove from history"
                  >
                    <IconX size={14} />
                  </button>
                </Link>

                <div className="p-3">
                  <Link href={`/watch/${item.vkey}`}>
                    <h3 className="text-sm font-semibold text-white group-hover:text-[#ff9900] transition-colors line-clamp-2 leading-snug">
                      {item.title || 'Untitled Video'}
                    </h3>
                  </Link>

                  {item.updatedAt && (
                    <p className="text-[11px] text-neutral-500 mt-2 flex items-center gap-1">
                      <IconClock size={12} />
                      <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
