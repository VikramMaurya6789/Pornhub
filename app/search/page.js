'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import VideoCard, { VideoGridSkeleton } from '../../components/VideoCard';
import Pagination from '../../components/UI';
import { IconSearch } from '../../components/Icons';
import { parseDurationSec } from '../../lib/format';
import BackToTop from '../../components/BackToTop';

const POPULAR_SEARCHES = [
  'Stepmom', 'Amateur', 'POV', 'MILF', 'Threesome', 'Latina',
  'Eva Elfie', 'Sweetie Fox', 'Indian', 'Lesbian', 'Anal', 'Blowjob', 'College'
];

function SearchInner() {
  const sp = useSearchParams();
  const q = sp.get('q') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1'));
  const sort = sp.get('sort') || 'relevant';
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

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

  // Safety floor: full-length videos only (API already enforces this too)
  const videos = Array.isArray(data?.videos)
    ? data.videos.filter((v) => parseDurationSec(v.duration) >= 600)
    : [];

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="fade-in text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
          <IconSearch size={22} className="text-[#ff9900]" />
          Results for <span className="text-[#ff9900]">&ldquo;{q}&rdquo;</span>
        </h1>
        <p className="text-xs text-neutral-400 mt-1">Full length HD videos • 10+ minutes only</p>
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
