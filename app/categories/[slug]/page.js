'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import VideoCard, { VideoGridSkeleton } from '../../../components/VideoCard';
import Pagination from '../../../components/UI';
import ListingFilterBar from '../../../components/ListingFilterBar';
import { parseDurationSec, parseViewsNumber } from '../../../lib/format';

function CategoriesSlugInner() {
  const params = useParams();
  const sp = useSearchParams();
  const rawSlug = (params?.slug || '').trim();
  const page = Math.max(1, parseInt(sp.get('page') || '1'));
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  // Filter states
  const [duration, setDuration] = useState('all');
  const [hdOnly, setHdOnly] = useState(false);
  const [sort, setSort] = useState('newest');

  const categoryQuery = `/categories/${rawSlug}`;

  useEffect(() => {
    if (!rawSlug) return;
    setData(null);
    setErr(null);
    (async () => {
      try {
        const r = await fetch(`/api/category?slug=${encodeURIComponent(categoryQuery)}&page=${page}`, { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed to load category videos');
        setData(j);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [categoryQuery, page, rawSlug]);

  // Apply listing filters
  const filteredVideos = useMemo(() => {
    let list = Array.isArray(data?.videos) ? [...data.videos] : [];

    // 1. Duration filter (all strictly >= 10 min = 600s)
    list = list.filter((v) => {
      const sec = parseDurationSec(v.duration);
      if (sec < 600) return false;
      if (duration === '10-20') return sec <= 1200;
      if (duration === '20-40') return sec > 1200 && sec <= 2400;
      if (duration === '40+') return sec > 2400;
      return true;
    });

    // 2. HD Only
    if (hdOnly) {
      list = list.filter((v) => Boolean(v.hd));
    }

    // 3. Sort
    if (sort === 'viewed') {
      list.sort((a, b) => parseViewsNumber(b.views) - parseViewsNumber(a.views));
    } else if (sort === 'longest') {
      list.sort((a, b) => parseDurationSec(b.duration) - parseDurationSec(a.duration));
    } else if (sort === 'rated') {
      list.sort((a, b) => (parseInt(b.percent || '95') || 95) - (parseInt(a.percent || '95') || 95));
    }

    return list;
  }, [data?.videos, duration, hdOnly, sort]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="fade-in text-xl md:text-2xl font-bold text-white capitalize">
          {data ? data.title : rawSlug.replace(/[-_]/g, ' ')}
        </h1>
        <p className="text-xs text-neutral-400 mt-1">Full length HD videos • 10+ minutes only</p>
      </div>

      <ListingFilterBar
        duration={duration}
        onDurationChange={setDuration}
        hdOnly={hdOnly}
        onHdOnlyChange={setHdOnly}
        sort={sort}
        onSortChange={setSort}
        totalCount={filteredVideos.length}
      />

      {err && <p className="text-red-400 text-sm mb-6">Failed to load: {err}</p>}

      {!data && !err ? (
        <VideoGridSkeleton n={18} />
      ) : data && (
        <>
          {filteredVideos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-7">
              {filteredVideos.map((v, i) => (
                <VideoCard key={v.vkey || i} v={v} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-[#111] rounded-2xl border border-[#222]">
              <p className="text-neutral-400 text-sm mb-3">No videos matched your filter criteria.</p>
              <button
                type="button"
                onClick={() => {
                  setDuration('all');
                  setHdOnly(false);
                  setSort('newest');
                }}
                className="px-4 py-2 rounded-xl bg-[#ff9900] text-black font-bold text-xs"
              >
                Reset Filters
              </button>
            </div>
          )}
          <Pagination page={page} base={`/categories/${encodeURIComponent(rawSlug)}`} />
        </>
      )}
    </div>
  );
}

export default function CategoriesSlugPage() {
  return (
    <Suspense fallback={<div className="max-w-[1600px] mx-auto px-4 py-6"><VideoGridSkeleton n={18} /></div>}>
      <CategoriesSlugInner />
    </Suspense>
  );
}
