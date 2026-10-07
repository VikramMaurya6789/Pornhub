'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import VideoCard, { VideoGridSkeleton } from '../../components/VideoCard';
import Pagination from '../../components/UI';
import { IconSearch, IconChevronD, IconCheck } from '../../components/Icons';
import { parseDurationSec } from '../../lib/format';
import BackToTop from '../../components/BackToTop';

const POPULAR_SEARCHES = [
  'Stepmom', 'Amateur', 'POV', 'MILF', 'Threesome', 'Latina',
  'Eva Elfie', 'Sweetie Fox', 'Indian', 'Lesbian', 'Anal', 'Blowjob', 'College'
];

const SORT_OPTIONS = [
  { value: 'relevant', label: 'Most Relevant' },
  { value: 'viewed', label: 'Most Viewed' },
  { value: 'rated', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'longest', label: 'Longest' },
];

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.get('q') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1'));
  const sort = sp.get('sort') || 'relevant';
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    setData(null);
    setErr(null);
    (async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&page=${page}&sort=${sort}`, { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'search failed');
        setData(j);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [q, page, sort]);

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e) => {
      if (!e.target.closest('.sort-dropdown')) setSortOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [sortOpen]);

  const changeSort = (newSort) => {
    setSortOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}&page=1&sort=${newSort}`);
  };

  const activeSort = SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0];

  // Safety floor: full-length videos only (API already enforces this too)
  const videos = Array.isArray(data?.videos)
    ? data.videos.filter((v) => parseDurationSec(v.duration) >= 600)
    : [];

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      {/* Header with result count and sort */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="fade-in flex items-center gap-2.5 text-xl md:text-2xl font-extrabold text-white tracking-tight">
              <span className="w-9 h-9 rounded-xl bg-[#ff9900]/10 border border-[#ff9900]/20 flex items-center justify-center text-[#ff9900] shrink-0">
                <IconSearch size={18} />
              </span>
              <span className="truncate">Results for <span className="text-[#ff9900]">&ldquo;{q}&rdquo;</span></span>
            </h1>
            <p className="text-xs text-neutral-500 mt-2 ml-[3.25rem]">
              {data ? `${videos.length} videos` : 'Searching...'} • Full length HD • 10+ min only
            </p>
          </div>

          {/* Sort Dropdown */}
          {data && videos.length > 0 && (
            <div className="relative sort-dropdown shrink-0">
              <button
                type="button"
                onClick={() => setSortOpen((o) => !o)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#161616] border border-[#2a2a2a] hover:border-[#ff9900]/50 text-sm font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer"
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
              >
                <span className="text-neutral-500 text-xs uppercase tracking-wider">Sort:</span>
                <span className="text-[#ff9900]">{activeSort.label}</span>
                <IconChevronD size={14} className={`text-neutral-500 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-[52px] z-50 w-48 bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden fade-in" role="listbox">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={opt.value === sort}
                      onClick={() => changeSort(opt.value)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left transition-colors cursor-pointer ${
                        opt.value === sort
                          ? 'bg-[#ff9900]/10 text-[#ff9900]'
                          : 'text-neutral-300 hover:bg-[#1f1f1f] hover:text-white'
                      }`}
                    >
                      {opt.label}
                      {opt.value === sort && <IconCheck size={16} className="text-[#ff9900]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {err && <p className="text-red-400 text-sm mb-6">Search failed: {err}</p>}

      {!data && !err ? (
        <VideoGridSkeleton n={18} />
      ) : data && (
        <>
          {videos.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-7">
                {videos.map((v, i) => (
                  <VideoCard key={v.vkey || i} v={v} index={i} />
                ))}
              </div>
              <Pagination
                page={page}
                base={`/search?q=${encodeURIComponent(q)}`}
                extra={`&sort=${sort}`}
              />
            </>
          ) : (
            <div className="text-center py-16 px-4 bg-[#111] rounded-2xl border border-[#222]">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#1c1c1c] flex items-center justify-center text-[#ff9900] mb-4">
                <IconSearch size={28} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No direct matches for &ldquo;{q}&rdquo;</h3>
              <p className="text-neutral-400 text-sm max-w-md mx-auto mb-6">
                Try searching for related keywords or explore trending categories below:
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
                {POPULAR_SEARCHES.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="px-3.5 py-1.5 rounded-full bg-[#1c1c1c] hover:bg-[#ff9900] hover:text-black text-xs font-semibold text-neutral-300 transition-colors border border-[#2c2c2c]"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <>
      <Suspense fallback={<div className="max-w-[1600px] mx-auto px-4 py-6"><VideoGridSkeleton n={18} /></div>}>
        <SearchInner />
      </Suspense>
      <BackToTop />
    </>
  );
}
