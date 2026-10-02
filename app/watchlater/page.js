'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LibraryNav from '../../components/LibraryNav';
import VideoCard from '../../components/VideoCard';
import { IconClock, IconFlame, IconPlay, IconX, IconTrash } from '../../components/Icons';
import { hasRejectedFunctional, openCookiePreferences } from '../../lib/consent';
import {
  WATCHLATER_CHANGED_EVENT,
  getWatchLater,
  removeWatchLater,
  clearWatchLater,
} from '../../lib/watchlater';
import { clearQueue, addToQueue } from '../../lib/queue';

export default function WatchLaterPage() {
  const router = useRouter();
  const [saved, setSaved] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [functionalDisabled, setFunctionalDisabled] = useState(false);

  useEffect(() => {
    const load = () => {
      if (hasRejectedFunctional()) {
        setFunctionalDisabled(true);
        setSaved([]);
        setLoaded(true);
        return;
      }
      setFunctionalDisabled(false);
      setSaved(getWatchLater());
      setLoaded(true);
    };

    load();

    window.addEventListener(WATCHLATER_CHANGED_EVENT, load);
    window.addEventListener('oh_consent_changed', load);
    return () => {
      window.removeEventListener(WATCHLATER_CHANGED_EVENT, load);
      window.removeEventListener('oh_consent_changed', load);
    };
  }, []);

  const handleRemove = (e, vkey) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    removeWatchLater(vkey);
    setSaved(getWatchLater());
  };

  const handleClear = () => {
    if (!confirm('Are you sure you want to remove all videos from Watch Later?')) return;
    clearWatchLater();
    setSaved([]);
  };

  const handlePlayAll = () => {
    const list = getWatchLater();
    if (list.length === 0) return;
    clearQueue();
    list.forEach((v) => addToQueue(v));
    router.push(`/watch/${list[0].vkey}`);
  };

  if (!loaded) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="h-8 w-48 rounded-lg skeleton mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-xl skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <LibraryNav />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1f1f1f] mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#ff9900]/15 text-[#ff9900]">
              <IconClock size={26} />
            </span>
            Watch Later
            {saved.length > 0 && (
              <span className="text-xs font-bold bg-[#ff9900] text-black rounded-full px-2.5 py-1 min-w-[32px] text-center">
                {saved.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            {saved.length} {saved.length === 1 ? 'saved video' : 'saved videos'} waiting for you
          </p>
        </div>

        {saved.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handlePlayAll}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold text-sm transition-all hover:scale-[1.02] cursor-pointer"
            >
              <IconPlay size={18} /> Play all
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#1c1c1c] hover:bg-red-950/40 border border-[#2a2a2a] hover:border-red-800 text-xs font-semibold text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <IconTrash size={16} /> Clear
            </button>
          </div>
        )}
      </div>

      {functionalDisabled ? (
        <div className="py-20 text-center max-w-md mx-auto fade-in">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-[#ff9900]">
            <IconClock size={36} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Watch Later is currently disabled</h2>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Enable functional cookies to save videos to Watch Later and access them anytime.
          </p>
          <button
            type="button"
            onClick={openCookiePreferences}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold text-sm transition-all hover:scale-[1.02] cursor-pointer"
          >
            Enable functional cookies to use this
          </button>
        </div>
      ) : saved.length === 0 ? (
        <div className="py-20 text-center max-w-md mx-auto fade-in">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-neutral-600">
            <IconClock size={36} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No videos saved yet</h2>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Tap the <span className="text-[#ff9900] font-semibold">clock icon</span> on any video to save it here for later.
          </p>
          <Link
            href="/list/hottest"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold text-sm transition-all hover:scale-[1.02]"
          >
            <IconFlame size={18} /> Explore Hottest Videos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-7">
          {saved.map((v, idx) => (
            <div key={v.vkey || idx} className="relative" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
              <VideoCard v={v} index={idx} />
              <button
                type="button"
                onClick={(e) => handleRemove(e, v.vkey)}
                className="absolute top-2 left-2 w-9 h-9 rounded-full bg-black/75 hover:bg-red-600 text-neutral-300 hover:text-white flex items-center justify-center transition-colors shadow-lg cursor-pointer z-10"
                title="Remove from Watch Later"
                aria-label="Remove from Watch Later"
              >
                <IconX size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
