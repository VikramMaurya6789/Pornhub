'use client';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import VideoCard, { VideoGridSkeleton } from '../components/VideoCard';
import { SectionHeader } from '../components/UI';
import {
  IconFlame,
  IconEye,
  IconSparkles,
  IconChevronR,
  IconStar,
  IconInfinity,
  IconRefresh,
  IconHistory,
  IconX,
  IconSearch,
  IconBell,
} from '../components/Icons';
import CategorySidebar, { MobileCategoryChips } from '../components/CategorySidebar';
import BackToTop from '../components/BackToTop';
import { getUserId } from '../lib/uid';
import { hasRejectedFunctional } from '../lib/consent';

async function getFeed(type, page = 1, mix = 0) {
  const r = await fetch(`/api/feed?type=${type}&page=${page}&mix=${mix}`);
  if (!r.ok) throw new Error('feed failed');
  return r.json();
}

function parseDurationSec(d) {
  if (!d) return 0;
  if (typeof d === 'number') return d;
  const s = String(d).trim();
  const parts = s.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) return parts[0] * 60 + parts[1];
  return 0;
}

const CYCLE_FEEDS = ['top_rated', 'newest', 'home', 'hottest', 'most_viewed'];

export default function HomePage() {
  const [home, setHome] = useState(null);
  const [hottest, setHottest] = useState(null);
  const [viewed, setViewed] = useState(null);
  const [topRated, setTopRated] = useState(null);
  const [err, setErr] = useState(null);
  const [history, setHistory] = useState([]);
  const [subsRail, setSubsRail] = useState([]);
  const [trendingSearches, setTrendingSearches] = useState([]);
  const [mixIndex, setMixIndex] = useState(0);

  const refreshMix = useCallback(() => {
    setHome(null);
    setHottest(null);
    setViewed(null);
    setTopRated(null);
    setMixIndex((m) => m + 1);
  }, []);

  // Automatic background video sync (throttled to once every 15 minutes)
  useEffect(() => {
    try {
      const lastSync = parseInt(localStorage.getItem('oh_last_sync') || '0', 10);
      const now = Date.now();
      if (now - lastSync > 15 * 60 * 1000) {
        localStorage.setItem('oh_last_sync', String(now));
        fetch('/api/sync', { method: 'POST' }).catch(() => {});
      }
    } catch {}
  }, []);

  // Initial progressive fetch: load primary feed instantly, then secondary sections
  useEffect(() => {
    let active = true;

    getFeed('home', 1, mixIndex)
      .then((data) => {
        if (active) setHome(data.videos || []);
      })
      .catch((e) => {
        if (active) setErr(e.message);
      });

    getFeed('hottest', 1, mixIndex)
      .then((data) => {
        if (active) setHottest(data.videos || []);
      })
      .catch(() => {});

    getFeed('most_viewed', 1, mixIndex)
      .then((data) => {
        if (active) setViewed(data.videos || []);
      })
      .catch(() => {});

    getFeed('top_rated', 1, mixIndex)
      .then((data) => {
        if (active) setTopRated(data.videos || []);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [mixIndex]);

  useEffect(() => {
    fetch('/api/trending-searches')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.queries) && data.queries.length > 0) {
          setTrendingSearches(data.queries);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const loadHistory = () => {
      if (hasRejectedFunctional()) {
        setHistory([]);
        return;
      }
      const uid = getUserId();
      if (uid) {
        fetch(`/api/history?uid=${encodeURIComponent(uid)}`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data.history) && data.history.length > 0) {
              setHistory(data.history);
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
          });
      } else {
        try {
          const raw = localStorage.getItem('oh_history');
          if (raw) setHistory(JSON.parse(raw));
        } catch {}
      }
    };

    loadHistory();
    window.addEventListener('oh_consent_changed', loadHistory);
    return () => window.removeEventListener('oh_consent_changed', loadHistory);
  }, []);

  // New from your subscriptions rail: latest videos from the first 4 followed uploaders
  useEffect(() => {
    let active = true;
    const loadSubsRail = async () => {
      try {
        if (hasRejectedFunctional()) {
          if (active) setSubsRail([]);
          return;
        }
        const raw = localStorage.getItem('oh_subscriptions');
        const subs = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(subs) || subs.length === 0) {
          if (active) setSubsRail([]);
          return;
        }
        const results = await Promise.all(
          subs.slice(0, 4).map((s) =>
            fetch(`/api/pornstar?slug=${encodeURIComponent(s.slug)}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        if (!active) return;
        const seen = new Set();
        const videos = [];
        for (const data of results) {
          for (const v of (data?.videos || []).slice(0, 3)) {
            if (!v || !v.vkey || seen.has(v.vkey)) continue;
            if (parseDurationSec(v.duration) < 600) continue;
            seen.add(v.vkey);
            videos.push(v);
            if (videos.length >= 12) break;
          }
          if (videos.length >= 12) break;
        }
        setSubsRail(videos);
      } catch {
        if (active) setSubsRail([]);
      }
    };
    loadSubsRail();
    window.addEventListener('oh_subscriptions_changed', loadSubsRail);
    return () => {
      active = false;
      window.removeEventListener('oh_subscriptions_changed', loadSubsRail);
    };
  }, []);

  // Compute initial sections with strict deduplication and duration >= 10 mins (600s)
  const { hero, recommended, hottestList, viewedList, initialStream } = useMemo(() => {
    const seen = new Set();

    const isLong = (v) => {
      if (!v) return false;
      const sec = parseDurationSec(v.duration);
      return sec >= 600;
    };

    // 1. Hero
    const heroVid = (home || []).find((v) => Boolean(v.vkey || v.title) && isLong(v)) || null;
    if (heroVid) {
      if (heroVid.vkey) seen.add(heroVid.vkey);
      if (heroVid.title) seen.add(heroVid.title.toLowerCase().trim());
    }

    const filterUnique = (list, max = 15) => {
      const out = [];
      for (const v of list || []) {
        if (!isLong(v)) continue;
        const vkey = v.vkey;
        const titleKey = v.title ? v.title.toLowerCase().trim() : null;
        if (vkey && seen.has(vkey)) continue;
        if (titleKey && seen.has(titleKey)) continue;

        if (vkey) seen.add(vkey);
        if (titleKey) seen.add(titleKey);
        out.push(v);
        if (out.length >= max) break;
      }
      return out;
    };

    const recList = filterUnique(home, 15);
    const hotList = filterUnique(hottest, 15);
    const mvList = filterUnique(viewed, 15);
    const initStream = filterUnique(topRated, 15);

    return {
      hero: heroVid,
      recommended: recList,
      hottestList: hotList,
      viewedList: mvList,
      initialStream: initStream,
    };
  }, [home, hottest, viewed, topRated]);

  const gridClass = "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-7";

  return (
    <div className="max-w-[1720px] mx-auto px-3 sm:px-4 lg:px-6 pb-16">
      {/* Mobile Category Chips */}
      <div className="mt-3 lg:hidden">
        <MobileCategoryChips />
      </div>

      <div className="flex items-start gap-6 mt-4">
        {/* Left Desktop Category Sidebar */}
        <CategorySidebar />

        {/* Main Feed Content */}
        <main className="flex-1 min-w-0">
          {/* Trending Searches Chip Row (Top 12 queries - Hide when empty) */}
          {trendingSearches.length > 0 && (
            <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
              <span className="flex items-center gap-1.5 font-bold text-neutral-400 shrink-0 uppercase tracking-wider text-[11px] mr-1">
                <IconSearch size={13} className="text-[#ff9900]" />
                Trending:
              </span>
              {trendingSearches.map((q) => (
                <Link
                  key={q}
                  href={`/search?q=${encodeURIComponent(q)}`}
                  className="shrink-0 px-3 py-1 rounded-full bg-[#161616] hover:bg-[#ff9900] text-neutral-300 hover:text-black border border-white/10 hover:border-[#ff9900] transition-colors font-medium text-xs shadow-sm"
                >
                  {q}
                </Link>
              ))}
            </div>
          )}

          {/* Hero Banner */}
          {hero ? (
            <Link href={`/watch/${hero.vkey}`} prefetch={false} className="fade-in group relative block rounded-2xl overflow-hidden ring-1 ring-white/10">
              <div className="relative aspect-[16/9] sm:aspect-[21/8] min-h-[190px] md:min-h-[300px]">
                <img
                  src={hero.thumbnail}
                  alt={hero.title || 'Featured Today'}
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-4 md:p-8 max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 bg-[#ff9900] text-black text-[11px] font-black px-2.5 py-1 rounded-md mb-2 md:mb-3 uppercase tracking-wide">
                    <IconFlame size={13} /> Featured Today • Daily Fresh Pick
                  </span>
                  <h1 className="clamp-2 text-lg sm:text-2xl md:text-3xl font-black text-white leading-tight mb-2 group-hover:text-[#ff9900] transition-colors">{hero.title}</h1>
                  <div className="flex items-center gap-4 text-sm text-neutral-300">
                    {hero.duration && <span className="bg-white/10 px-2 py-0.5 rounded text-[13px]">{hero.duration !== '0:00' && hero.duration !== '0' ? hero.duration : '--:--'}</span>}
                    {hero.views && <span>{hero.views}</span>}
                    <span className="hidden sm:inline text-[#ff9900] font-semibold items-center gap-1">Watch now <IconChevronR size={16} /></span>
                  </div>
                </div>
              </div>
            </Link>
          ) : !err && (
            <div className="aspect-[16/9] sm:aspect-[21/8] min-h-[190px] md:min-h-[300px] rounded-2xl skeleton" />
          )}

          {err && (
            <div className="mt-4 p-6 rounded-2xl bg-[#160a0a] border border-red-900/50 text-center">
              <p className="text-red-400 font-semibold mb-1">Couldn&apos;t load videos</p>
              <p className="text-sm text-neutral-400">{err} — the source may be rate-limiting. Try reloading in a bit.</p>
            </div>
          )}

          {/* Trending Searches Strip (desktop only — mobile uses the chip row above) */}
          {trendingSearches.length > 0 && (
            <section className="hidden sm:block mt-6 p-4 rounded-2xl bg-[#121212] border border-[#222]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#ff9900]"><IconFlame size={18} /></span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Trending Searches</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1c1c1c] hover:bg-[#ff9900]/15 hover:border-[#ff9900]/50 border border-white/5 text-xs text-neutral-300 hover:text-[#ff9900] transition-all"
                  >
                    <IconSearch size={12} className="text-neutral-500" />
                    <span>{term}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Continue Watching History Shelf */}
          {history.length > 0 && (
            <section className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-[#141414] to-[#0a0a0a] border border-[#222] shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <IconHistory size={20} className="text-[#ff9900]" />
                  Continue Watching
                </h2>
                <button
                  onClick={async () => {
                    const uid = getUserId();
                    try { localStorage.removeItem('oh_history'); } catch {}
                    const toRemove = [...history];
                    setHistory([]);
                    if (uid) {
                      for (const h of toRemove) {
                        fetch(`/api/history?uid=${encodeURIComponent(uid)}&vkey=${encodeURIComponent(h.vkey)}`, {
                          method: 'DELETE',
                        }).catch(() => {});
                      }
                    }
                  }}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                >
                  Clear History
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {history.slice(0, 5).map((item) => {
                  const pct = (typeof item.durationSec === 'number' && item.durationSec > 0 && typeof item.progressSec === 'number')
                    ? Math.min(100, Math.max(5, Math.round((item.progressSec / item.durationSec) * 100)))
                    : (typeof item.progress === 'number' ? Math.max(5, item.progress) : 10);

                  return (
                    <div
                      key={item.vkey}
                      className="group relative rounded-xl overflow-hidden bg-[#161616] border border-white/5 hover:border-[#ff9900]/60 transition-all shadow-md flex flex-col justify-between"
                    >
                      <div className="relative aspect-video overflow-hidden bg-black">
                        <Link href={`/watch/${item.vkey}`} className="block w-full h-full">
                          <img
                            src={item.thumbnail}
                            alt={item.title || ''}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </Link>
                        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/70 pointer-events-none">
                          <div
                            className="h-full bg-[#ff9900]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {item.duration && (
                          <span className="absolute bottom-2.5 right-1.5 bg-black/85 text-[10px] text-white px-1.5 py-0.5 rounded font-bold pointer-events-none">
                            {item.duration !== '0:00' && item.duration !== '0' ? item.duration : '--:--'}
                          </span>
                        )}
                        {/* Remove button (X) per card */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const uid = getUserId();
                            const updated = history.filter((h) => h.vkey !== item.vkey);
                            setHistory(updated);
                            try {
                              localStorage.setItem('oh_history', JSON.stringify(updated));
                            } catch {}
                            if (uid) {
                              fetch(`/api/history?uid=${encodeURIComponent(uid)}&vkey=${encodeURIComponent(item.vkey)}`, {
                                method: 'DELETE',
                              }).catch(() => {});
                            }
                          }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/80 hover:bg-red-600 text-neutral-300 hover:text-white flex items-center justify-center transition-colors shadow-lg opacity-80 group-hover:opacity-100 cursor-pointer z-10"
                          title="Remove from history"
                          aria-label="Remove from history"
                        >
                          <IconX size={12} />
                        </button>
                      </div>
                      <div className="p-2.5">
                        <Link
                          href={`/watch/${item.vkey}`}
                          className="text-xs font-semibold text-white group-hover:text-[#ff9900] truncate transition-colors block"
                        >
                          {item.title}
                        </Link>
                        <p className="text-[11px] text-[#ff9900] mt-1 font-medium flex items-center justify-between">
                          <span>Resume ({pct}%)</span>
                          <span className="text-neutral-500 text-[10px] truncate max-w-[80px]">{item.author || ''}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* New from your subscriptions */}
          {subsRail.length > 0 && (
            <section className="mt-8 content-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <IconBell size={20} className="text-[#ff9900]" />
                  New from your subscriptions
                </h2>
                <Link href="/subscriptions" className="text-sm font-semibold text-[#ff9900] hover:text-[#ffb340] flex items-center gap-1 transition-colors">
                  View all <IconChevronR size={16} />
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
                {subsRail.map((v, i) => (
                  <div key={v.vkey || i} className="w-[240px] sm:w-[260px] shrink-0 snap-start">
                    <VideoCard v={v} index={i} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Featured Sections */}
          <div className="mt-10 space-y-14">
            {/* 1. Today's Fresh Releases */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[#ff9900]"><IconSparkles size={24} /></span>
                  <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                    <span>Today&apos;s Fresh Releases</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#ff9900]/20 text-[#ff9900] border border-[#ff9900]/40 uppercase tracking-wide">
                      Daily New
                    </span>
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={refreshMix}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[#ff9900]/15 text-neutral-300 hover:text-[#ff9900] text-xs font-semibold border border-white/10 hover:border-[#ff9900]/30 transition-all active:scale-95"
                    title="Shuffle for more fresh daily videos"
                  >
                    <IconRefresh size={14} className={!home ? "animate-spin" : ""} />
                    <span>Shuffle Daily Mix</span>
                  </button>
                  <Link href="/list/newest" className="text-sm font-semibold text-[#ff9900] hover:text-[#ffb340] flex items-center gap-1 transition-colors">
                    View all <IconChevronR size={16} />
                  </Link>
                </div>
              </div>
              {!home ? <VideoGridSkeleton n={15} className={gridClass} /> : (
                <div className={gridClass}>
                  {recommended.map((v, i) => <VideoCard key={v.vkey || i} v={v} index={i} />)}
                </div>
              )}
            </section>

            {/* 2. Hottest */}
            <section className="content-auto">
              <SectionHeader title="Hottest right now" href="/list/hottest" icon={IconFlame} />
              {!hottest ? <VideoGridSkeleton n={15} className={gridClass} /> : (
                <div className={gridClass}>
                  {hottestList.map((v, i) => <VideoCard key={v.vkey || i} v={v} index={i} />)}
                </div>
              )}
            </section>

            {/* 3. Most Viewed */}
            <section className="content-auto">
              <SectionHeader title="Most viewed" href="/list/most_viewed" icon={IconEye} />
              {!viewed ? <VideoGridSkeleton n={15} className={gridClass} /> : (
                <div className={gridClass}>
                  {viewedList.map((v, i) => <VideoCard key={v.vkey || i} v={v} index={i} />)}
                </div>
              )}
            </section>

            {/* 4. Top Rated Full Length (10+ min) */}
            <section className="content-auto pt-8 border-t border-[#1e1e1e]">
              <SectionHeader title="Top rated full length (10+ min)" href="/list/top_rated" icon={IconStar} />
              {!topRated ? (
                <VideoGridSkeleton n={15} className={gridClass} />
              ) : (
                <div className={gridClass}>
                  {initialStream.map((v, i) => (
                    <VideoCard key={v.vkey || `top-${i}`} v={v} index={i} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
        <BackToTop />
      </div>
    </div>
  );
}
