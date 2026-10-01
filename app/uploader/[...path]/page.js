'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import VideoCard, { VideoGridSkeleton } from '../../../components/VideoCard';
import Pagination from '../../../components/UI';
import { IconFlame, IconCheck, IconChevronL } from '../../../components/Icons';

function UploaderContent() {
  const params = useParams();
  const pathSegments = params?.path || [];
  const uploaderPath = '/' + (Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments);
  const searchParams = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!uploaderPath || uploaderPath === '/') return;
    setLoading(true);
    setErr(null);

    fetch(`/api/uploader?url=${encodeURIComponent(uploaderPath)}&page=${page}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load uploader videos');
        return res.json();
      })
      .then((json) => {
        setData(json);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [uploaderPath, page]);

  const name = data?.name || (pathSegments[1] ? pathSegments[1].replace(/[-_]/g, ' ') : 'Uploader');
  const fallbackAvatar = `/api/avatar?name=${encodeURIComponent(name)}`;
  const avatar = data?.avatar || fallbackAvatar;
  const videos = data?.videos || [];

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 md:py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs md:text-sm text-neutral-400">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span>/</span>
        <span className="text-neutral-500">Creator</span>
        <span>/</span>
        <span className="text-[#ff9900] font-medium">{name}</span>
      </div>

      {/* Profile Header */}
      <div className="mb-8 p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#181818] via-[#141414] to-[#0f0f0f] border border-[#262626] shadow-2xl flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="relative shrink-0">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden ring-3 ring-[#ff9900]/70 bg-[#222] shadow-xl shadow-[#ff9900]/15 flex items-center justify-center">
            <img
              src={avatar}
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = fallbackAvatar;
              }}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#ff9900] text-black p-1.5 rounded-full shadow-md">
            <IconCheck size={14} className="text-black" />
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              {name}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ff9900]/15 text-[#ff9900] border border-[#ff9900]/30">
              Verified Creator
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-400 max-w-2xl">
            Browse and stream all full HD videos uploaded by {name}. Free high-definition streaming with zero ads and uninterrupted playback.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-semibold text-neutral-300">
            <div className="flex items-center gap-1.5 bg-[#202020] px-3 py-1.5 rounded-lg border border-[#2d2d2d]">
              <IconFlame size={14} className="text-[#ff9900]" />
              <span>{videos.length ? `${videos.length}+ Videos on page` : 'Verified Collection'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#202020] px-3 py-1.5 rounded-lg border border-[#2d2d2d]">
              <span className="text-[#ff9900]">Page {page}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Videos Section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          <IconFlame size={18} className="text-[#ff9900]" />
          Videos by {name}
        </h2>
      </div>

      {loading ? (
        <VideoGridSkeleton n={15} />
      ) : err ? (
        <div className="p-8 text-center bg-[#141414] rounded-xl border border-red-500/20 text-neutral-300">
          <p className="text-red-400 font-semibold mb-2">Could not load videos for {name}</p>
          <p className="text-sm text-neutral-500 mb-4">{err}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff9900] text-black font-bold text-sm"
          >
            <IconChevronL size={16} /> Return to Home
          </Link>
        </div>
      ) : videos.length === 0 ? (
        <div className="p-12 text-center bg-[#141414] rounded-xl border border-[#222]">
          <p className="text-neutral-400 text-base mb-4">No videos found for this uploader.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff9900] text-black font-bold text-sm"
          >
            <IconChevronL size={16} /> Return to Home
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-7">
            {videos.map((v, i) => (
              <VideoCard key={v.vkey || i} v={v} index={i} />
            ))}
          </div>

          <Pagination page={page} base={`/uploader/${Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments}`} />
        </>
      )}
    </div>
  );
}

export default function UploaderPage() {
  return (
    <Suspense fallback={<div className="max-w-[1600px] mx-auto px-4 py-8"><VideoGridSkeleton n={15} /></div>}>
      <UploaderContent />
    </Suspense>
  );
}
