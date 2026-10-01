'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import VideoCard, { VideoGridSkeleton } from '../../../components/VideoCard';
import Pagination, { SectionHeader } from '../../../components/UI';
import { IconFlame, IconEye, IconStar, IconSparkles, IconRefresh, IconInfinity } from '../../../components/Icons';
import CategorySidebar, { MobileCategoryChips } from '../../../components/CategorySidebar';
import BackToTop from '../../../components/BackToTop';

const TYPES = {
  hottest: { title: 'Hottest videos', icon: IconFlame },
  most_viewed: { title: 'Most viewed videos', icon: IconEye },
  top_rated: { title: 'Top rated videos', icon: IconStar },
  newest: { title: 'Newest videos', icon: IconSparkles },
};

function ListPageContent() {
  const params = useParams();
  const type = params?.type || 'hottest';
  const sp = useSearchParams();
  const initialPage = Math.max(1, parseInt(sp.get('page') || '1'));
  const meta = TYPES[type] || TYPES.hottest;

  const [videos, setVideos] = useState(null);
  const [err, setErr] = useState(null);
  const [currPage, setCurrPage] = useState(initialPage);
  const [loadingMore, setLoadingMore] = useState(false);
  const seenKeys = useRef(new Set());

  useEffect(() => {
    setVideos(null);
    setErr(null);
    setCurrPage(initialPage);
    seenKeys.current.clear();

    (async () => {
      try {
        const r = await fetch(`/api/feed?type=${type}&page=${initialPage}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'failed');
        const list = j.videos || [];
        for (const v of list) {
          if (v.vkey) seenKeys.current.add(v.vkey);
          if (v.title) seenKeys.current.add(v.title.toLowerCase().trim());
        }
        setVideos(list);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [type, initialPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextPage = currPage + 1;
    try {
      const r = await fetch(`/api/feed?type=${type}&page=${nextPage}`);
      const j = await r.json();
      if (r.ok && j.videos) {
        const unique = [];
        for (const v of j.videos) {
          const k = v.vkey;
          const t = v.title ? v.title.toLowerCase().trim() : null;
          if (k && seenKeys.current.has(k)) continue;
          if (t && seenKeys.current.has(t)) continue;
          if (k) seenKeys.current.add(k);
          if (t) seenKeys.current.add(t);
          unique.push(v);
        }
        setVideos((prev) => [...(prev || []), ...unique]);
        setCurrPage(nextPage);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [currPage, loadingMore, type]);

  const gridClass = "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-7";

  return (
    <div className="max-w-[1720px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
      <MobileCategoryChips />

      <div className="flex items-start gap-6 mt-4">
        <CategorySidebar />

        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <SectionHeader title={meta.title} icon={meta.icon} />
            {videos && (
              <span className="text-xs text-neutral-400 bg-[#161616] px-3 py-1 rounded-lg border border-[#222]">
                {videos.length} videos loaded
              </span>
            )}
          </div>

          {err && <p className="text-red-400 text-sm mb-4">Failed to load: {err}</p>}

          {!videos && !err ? (
            <VideoGridSkeleton n={20} className={gridClass} />
          ) : videos && (
            <>
              <div className={gridClass}>
                {videos.map((v, i) => <VideoCard key={v.vkey || i} v={v} index={i} />)}
              </div>

              {loadingMore && (
                <div className="mt-7">
                  <VideoGridSkeleton n={10} className={gridClass} />
                </div>
              )}

              {/* Load More Button & Pagination */}
              <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-[#1c1c1c]">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-xl bg-[#ff9900] hover:bg-[#ffa826] text-black font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <IconRefresh size={16} className={loadingMore ? 'animate-spin' : ''} />
                  <span>{loadingMore ? 'Loading More...' : 'Load More Videos (No Limit)'}</span>
                </button>

                <Pagination page={initialPage} base={`/list/${type}`} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ListPage() {
  return (
    <>
      <Suspense fallback={<div className="max-w-[1720px] mx-auto px-4 py-8"><VideoGridSkeleton n={20} /></div>}>
        <ListPageContent />
      </Suspense>
      <BackToTop />
    </>
  );
}
