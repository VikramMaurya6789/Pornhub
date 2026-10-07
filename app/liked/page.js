'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LibraryNav from '../../components/LibraryNav';
import VideoCard, { VideoGridSkeleton } from '../../components/VideoCard';
import { IconHeart, IconTrash, IconPlay } from '../../components/Icons';

export default function LikedVideosPage() {
  const [liked, setLiked] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('oh_liked_videos');
      if (raw) {
        setLiked(JSON.parse(raw));
      } else {
        // Fallback to favorites if liked not separately populated yet
        const favs = localStorage.getItem('oh_favorites_list');
        if (favs) setLiked(JSON.parse(favs));
      }
    } catch {}
    setLoaded(true);
  }, []);

  const handleClearAll = () => {
    if (!confirm('Are you sure you want to clear your liked videos?')) return;
    try {
      localStorage.removeItem('oh_liked_videos');
    } catch {}
    setLiked([]);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <LibraryNav />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
            <span className="w-11 h-11 rounded-xl bg-[#ff9900]/10 border border-[#ff9900]/20 flex items-center justify-center text-[#ff9900]">
              <IconHeart size={22} className="fill-[#ff9900]" />
            </span>
            <span>Liked Videos</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {liked.length} {liked.length === 1 ? 'video' : 'videos'} liked
          </p>
        </div>

        {liked.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/40 border border-red-800/50 hover:bg-red-900/60 text-red-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            <IconTrash size={15} />
            <span>Clear Liked Videos</span>
          </button>
        )}
      </div>

      {!loaded ? (
        <VideoGridSkeleton n={12} />
      ) : liked.length === 0 ? (
        <div className="text-center py-20 px-4 bg-[#121212] border border-[#222] rounded-3xl max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-[#1c1c1c] text-[#ff9900] flex items-center justify-center mx-auto mb-4">
            <IconHeart size={32} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No liked videos yet</h3>
          <p className="text-sm text-neutral-400 mb-6">
            Like videos using the thumbs up or heart button while watching, and they will be saved here.
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-7">
          {liked.map((v, i) => (
            <VideoCard key={v.vkey || i} v={v} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
