'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { IconEye, IconHeart, IconEyeOff, IconClock } from './Icons';
import { formatCount, parseDurationSec } from '../lib/format';
import { hasRejectedFunctional, openCookiePreferences } from '../lib/consent';
import { isWatchLater, toggleWatchLater, WATCHLATER_CHANGED_EVENT } from '../lib/watchlater';
import { haptic } from '../lib/haptics';

// Cached map of vkey -> watch progress % (from local history). Module-level
// so dozens of cards share a single localStorage read.
let progressCache = null;
function getProgressMap() {
  if (progressCache) return progressCache;
  progressCache = {};
  try {
    if (typeof window === 'undefined' || hasRejectedFunctional()) return progressCache;
    const raw = localStorage.getItem('oh_history');
    const list = raw ? JSON.parse(raw) : [];
    for (const h of list) {
      if (h && h.vkey && typeof h.currentTime === 'number') {
        const total = h.totalDuration || h.durationSec || 0;
        if (total > 0 && h.currentTime > 0) {
          progressCache[h.vkey] = Math.min(99, Math.round((h.currentTime / total) * 100));
        }
      }
    }
  } catch {}
  return progressCache;
}

export default function VideoCard({ v, index = 0 }) {
  const [scrubPos, setScrubPos] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [canHoverVideo, setCanHoverVideo] = useState(false);
  const [isDataSaver, setIsDataSaver] = useState(false);
  // Touch devices: the 3 overlay action buttons hide behind a single "more" button
  const [touchMenuOpen, setTouchMenuOpen] = useState(false);
  const touchVis = touchMenuOpen
    ? '[@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto'
    : '[@media(hover:none)]:opacity-0 [@media(hover:none)]:pointer-events-none';
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const rawHidden = localStorage.getItem('oh_hidden_videos');
      if (rawHidden) {
        const arr = JSON.parse(rawHidden);
        return Array.isArray(arr) && arr.includes(v.vkey);
      }
    } catch {}
    return false;
  });
  const videoRef = useRef(null);

  const [isFav, setIsFav] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (hasRejectedFunctional()) return false;
      return localStorage.getItem(`oh_saved_${v.vkey}`) === '1';
    } catch {
      return false;
    }
  });

  const [isWL, setIsWL] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (hasRejectedFunctional()) return false;
      return isWatchLater(v.vkey);
    } catch {
      return false;
    }
  });

  const [thumbSrc, setThumbSrc] = useState(v.thumbnail || null);
  const [imgFailed, setImgFailed] = useState(!v.thumbnail);
  const retriedRef = useRef(false);

  useEffect(() => {
    setThumbSrc(v.thumbnail || null);
    setImgFailed(!v.thumbnail);
    retriedRef.current = false;
  }, [v.thumbnail]);

  const handleImgError = () => {
    if (!retriedRef.current && v.thumbnail) {
      retriedRef.current = true;
      if (!String(thumbSrc || '').startsWith('/api/img')) {
        setThumbSrc(`/api/img?u=${encodeURIComponent(v.thumbnail)}`);
        return;
      }
    }
    setImgFailed(true);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
      setCanHoverVideo(true);
    }

    try {
      setIsDataSaver(localStorage.getItem('oh_datasaver') === '1');
    } catch {}

    const onDataSaver = () => {
      try {
        setIsDataSaver(localStorage.getItem('oh_datasaver') === '1');
      } catch {}
    };
    window.addEventListener('oh_datasaver_changed', onDataSaver);

    const handleConsent = () => {
      try {
        if (hasRejectedFunctional()) {
          setIsFav(false);
          setIsWL(false);
        } else {
          setIsFav(localStorage.getItem(`oh_saved_${v.vkey}`) === '1');
          setIsWL(isWatchLater(v.vkey));
        }
      } catch {}
    };
    window.addEventListener('oh_consent_changed', handleConsent);
    const handleWLChanged = () => {
      try {
        setIsWL(isWatchLater(v.vkey));
      } catch {}
    };
    window.addEventListener(WATCHLATER_CHANGED_EVENT, handleWLChanged);
    return () => {
      window.removeEventListener('oh_consent_changed', handleConsent);
      window.removeEventListener('oh_datasaver_changed', onDataSaver);
      window.removeEventListener(WATCHLATER_CHANGED_EVENT, handleWLChanged);
    };
  }, [v.vkey]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    setScrubPos(percent);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      try {
        videoRef.current.play().catch(() => {});
      } catch {}
    }
  };

  const handleMouseLeave = () => {
    setScrubPos(null);
    setIsHovered(false);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch {}
    }
  };

  const toggleFav = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent?.stopImmediatePropagation) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    if (hasRejectedFunctional()) {
      openCookiePreferences();
      return;
    }
    const next = !isFav;
    setIsFav(next);
    try {
      if (next) localStorage.setItem(`oh_saved_${v.vkey}`, '1');
      else localStorage.removeItem(`oh_saved_${v.vkey}`);

      const raw = localStorage.getItem('oh_favorites_list');
      const list = raw ? JSON.parse(raw) : [];
      if (next) {
        if (!list.some((item) => item.vkey === v.vkey)) {
          list.unshift({
            vkey: v.vkey,
            title: v.title,
            thumbnail: v.thumbnail,
            duration: v.duration,
            views: v.views,
            author: v.author,
            added: Date.now(),
          });
        }
      } else {
        const idx = list.findIndex((item) => item.vkey === v.vkey);
        if (idx !== -1) list.splice(idx, 1);
      }
      localStorage.setItem('oh_favorites_list', JSON.stringify(list));
    } catch {}
  };

  const toggleWL = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent?.stopImmediatePropagation) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    haptic();
    const next = toggleWatchLater({
      vkey: v.vkey,
      title: v.title,
      thumbnail: v.thumbnail,
      duration: v.duration,
      views: v.views,
      author: v.author,
    });
    if (next === null) {
      openCookiePreferences();
      return;
    }
    setIsWL(next);
  };

  const hideVideo = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent?.stopImmediatePropagation) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    try {
      const raw = localStorage.getItem('oh_hidden_videos');
      const list = raw ? JSON.parse(raw) : [];
      if (!list.includes(v.vkey)) {
        list.push(v.vkey);
        localStorage.setItem('oh_hidden_videos', JSON.stringify(list));
      }
      setIsHidden(true);
      window.dispatchEvent(new CustomEvent('oh_video_hidden', { detail: { vkey: v.vkey } }));
    } catch {}
  };

  // Only videos over 10 minutes (600s) should be displayed
  const durSec = parseDurationSec(v.duration);
  if (durSec > 0 && durSec < 600) return null;

  if (isHidden) return null;

  return (
    <Link
      href={`/watch/${v.vkey}`}
      prefetch={false}
      className="card-in card-hover-elevate group block relative"
      style={{ animationDelay: `${Math.min(index, 24) * 35}ms` }}
    >
      <div
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="shine-hover relative aspect-video rounded-xl overflow-hidden bg-[#141414] ring-1 ring-white/5 group-hover:ring-[#ff9900]/60 transition-all duration-300"
      >
        {/* Hover Video Preview for desktop (disabled when Data Saver is active) */}
        {canHoverVideo && !isDataSaver && v.preview && isHovered && (
          <video
            ref={videoRef}
            src={v.preview}
            muted
            loop
            playsInline
            autoPlay
            preload="none"
            className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-200"
            onLoadedData={(e) => {
              try {
                e.currentTarget.play().catch(() => {});
              } catch {}
            }}
          />
        )}

        {imgFailed ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#181818] to-[#0c0c0c] text-[#ff9900] select-none">
            <div className="w-11 h-11 rounded-full bg-black/60 border border-[#ff9900]/40 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:border-[#ff9900] transition-all duration-300">
              <svg className="w-5 h-5 ml-0.5 fill-[#ff9900]" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="mt-2 text-[10px] font-bold tracking-widest uppercase text-neutral-500 group-hover:text-neutral-300 transition-colors">
              OrangeHub
            </span>
          </div>
        ) : (
          <img
            src={thumbSrc}
            alt=""
            loading={index < 4 ? 'eager' : 'lazy'}
            fetchPriority={index < 4 ? 'high' : 'low'}
            decoding="async"
            onError={handleImgError}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Watch progress bar (from Continue Watching history) */}
        {(() => {
          const p = v && v.vkey ? getProgressMap()[v.vkey] : 0;
          return p > 1 && p < 99 ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/70 z-20 pointer-events-none">
              <div className="h-full bg-[#ff9900]" style={{ width: `${p}%` }} />
            </div>
          ) : null;
        })()}

        {/* Touch-only "more" button: reveals the 3 action buttons (they stay hover-only on desktop) */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setTouchMenuOpen((o) => !o); }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/75 text-neutral-200 flex [@media(hover:hover)]:hidden items-center justify-center shadow-md z-30 active:scale-90 cursor-pointer"
          title={touchMenuOpen ? 'Close' : 'More actions'}
          aria-label={touchMenuOpen ? 'Close' : 'More actions'}
          aria-expanded={touchMenuOpen}
        >
          {touchMenuOpen ? (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          )}
        </button>

        {/* Not Interested / Hide Video Button */}
        <button
          type="button"
          onClick={(e) => { setTouchMenuOpen(false); hideVideo(e); }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`absolute top-2 right-26 [@media(hover:none)]:right-38 w-11 h-11 rounded-full bg-black/75 text-neutral-300 hover:text-red-400 hover:bg-black/90 opacity-0 group-hover:opacity-100 ${touchVis} transition-all flex items-center justify-center shadow-md z-30 hover:scale-110 active:scale-90 cursor-pointer`}
          title="Not interested / Hide video"
          aria-label="Hide video"
        >
          <IconEyeOff size={18} />
        </button>

        {/* Watch Later Button */}
        <button
          type="button"
          onClick={(e) => { setTouchMenuOpen(false); toggleWL(e); }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`absolute top-2 right-14 [@media(hover:none)]:right-26 w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md z-30 cursor-pointer ${
            isWL
              ? 'bg-[#ff9900] text-black opacity-100'
              : `bg-black/75 text-neutral-300 hover:text-white opacity-0 group-hover:opacity-100 ${touchVis} hover:scale-110 active:scale-90`
          }`}
          title={isWL ? 'Saved to Watch Later' : 'Watch Later'}
          aria-label={isWL ? 'Remove from Watch Later' : 'Watch Later'}
        >
          <IconClock size={18} />
        </button>

        {/* Quick Save / Favorite Heart Button with Heart Pop Animation */}
        <button
          type="button"
          onClick={(e) => { setTouchMenuOpen(false); toggleFav(e); }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`absolute top-2 right-2 [@media(hover:none)]:right-14 w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md z-30 cursor-pointer ${
            isFav
              ? 'bg-[#ff9900] text-black opacity-100 scale-100 heart-pop'
              : `bg-black/75 text-neutral-300 hover:text-white opacity-0 group-hover:opacity-100 ${touchVis} hover:scale-110 active:scale-90`
          }`}
          title={isFav ? 'Saved to Favorites' : 'Add to Favorites'}
          aria-label={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
        >
          <IconHeart size={18} className={isFav ? 'fill-black' : ''} />
        </button>

        {/* Live Scrubbing Bar on Hover */}
        {scrubPos !== null && (
          <>
            <span className="absolute top-2 left-2 bg-black/85 text-[10px] font-bold text-[#ff9900] px-1.5 py-0.5 rounded shadow z-10">
              Preview
            </span>
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/70 z-20">
              <div
                className="h-full bg-[#ff9900] transition-all duration-75"
                style={{ width: `${scrubPos}%` }}
              />
            </div>
          </>
        )}

        {v.duration ? (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded z-10">
            {v.duration !== '0:00' && v.duration !== '0' ? v.duration : '--:--'}
          </span>
        ) : (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded z-10">
            --:--
          </span>
        )}

        {v.hd && (
          <span className="absolute top-2 left-2 bg-[#ff9900] text-black text-[10px] font-black px-1.5 py-0.5 rounded z-10">
            HD
          </span>
        )}

        {v.premium && (
          <span className="absolute top-2 left-10 bg-black/80 text-[#ff9900] text-[10px] font-black px-1.5 py-0.5 rounded border border-[#ff9900]/50 z-10">
            PREMIUM
          </span>
        )}
      </div>

      <h3 className="clamp-2 mt-2.5 text-[14px] leading-snug font-medium text-neutral-100 group-hover:text-[#ff9900] transition-colors min-h-[2.6em]">
        {v.title}
      </h3>

      <div className="mt-1 flex items-center gap-2 text-[12px] text-neutral-500">
        {v.views && (
          <span className="flex items-center gap-1">
            <IconEye size={13} />
            {formatCount(v.views)}
          </span>
        )}
        {v.author && (
          <span
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const slug = v.author
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
              window.location.href = `/pornstar/${slug}`;
            }}
            role="link"
            tabIndex={0}
            className="clamp-1 text-neutral-400 hover:text-[#ff9900] hover:underline cursor-pointer"
          >
            {v.author}
          </span>
        )}
      </div>
    </Link>
  );
}

function VideoCardSkeleton() {
  return (
    <div>
      <div className="aspect-video rounded-xl skeleton" />
      <div className="mt-2.5 h-4 rounded skeleton w-11/12" />
      <div className="mt-1.5 h-3 rounded skeleton w-2/3" />
    </div>
  );
}

export function VideoGridSkeleton({
  n = 12,
  className = 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-7',
}) {
  return (
    <div className={className}>
      {Array.from({ length: n }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}
