'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import VideoCard, { VideoGridSkeleton } from '../../../components/VideoCard';
import Pagination from '../../../components/UI';
import { parseDurationSec } from '../../../lib/format';
import BackToTop from '../../../components/BackToTop';

function CategorySlugInner() {
  const params = useParams();
  const sp = useSearchParams();
  const rawSlug = (params?.slug || '').trim();
  const page = Math.max(1, parseInt(sp.get('page') || '1'));
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  // Map slug e.g. "amateur" to standard category slug
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

  // Safety floor: full-length videos only (API already enforces this too)
  const videos = Array.isArray(data?.videos)
    ? data.videos.filter((v) => parseDurationSec(v.duration) >= 600)
    : [];

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="fade-in text-xl md:text-2xl font-bold text-white capitalize">
          {data ? data.title : rawSlug.replace(/[-_]/g, ' ')}
        </h1>
        <p className="text-xs text-neutral-400 mt-1">Full length HD videos • 10+ minutes only</p>
      </div>

      {err && <p className="text-red-400 text-sm mb-6">Failed to load: {err}</p>}

      {!data && !err ? (
        <VideoGridSkeleton n={18} />
      ) : data && (
        <>
          {videos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-7">
              {videos.map((v, i) => (
                <VideoCard key={v.vkey || i} v={v} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-[#111] rounded-2xl border border-[#222]">
              <p className="text-neutral-400 text-sm">No videos found in this category yet.</p>
            </div>
          )}
          <Pagination page={page} base={`/category/${encodeURIComponent(rawSlug)}`} />
        </>
      )}
    </div>
  );
}

export default function CategorySlugPage() {
  return (
    <>
      <Suspense fallback={<div className="max-w-[1600px] mx-auto px-4 py-6"><VideoGridSkeleton n={18} /></div>}>
        <CategorySlugInner />
      </Suspense>
      <BackToTop />
    </>
  );
}
