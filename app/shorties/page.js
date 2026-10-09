'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IconPlay, IconHeart, IconMessage } from '../../components/Icons';

export default function ShortiesPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch short videos (under 3 minutes) for the Shorties feed
    (async () => {
      try {
        const r = await fetch('/api/feed?section=shorties', { cache: 'no-store' });
        const j = await r.json();
        setVideos(j.videos || []);
      } catch {
        setVideos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 md:py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          <IconPlay size={28} className="text-[#ff9900]" />
          Shorties
        </h1>
        <p className="text-neutral-400 text-sm mt-2">Quick vertical videos - swipe through the best short clips.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-[9/16] rounded-xl bg-[#141414] animate-pulse" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 bg-[#141414] rounded-2xl border border-[#222]">
          <p className="text-neutral-400 mb-4">No short videos yet!</p>
          <p className="text-sm text-neutral-500">Short clips will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {videos.map((v) => (
            <Link key={v.vkey} href={`/watch/${v.vkey}`} className="group">
              <div className="aspect-[9/16] rounded-xl overflow-hidden bg-[#141414] relative">
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-xs font-medium text-white line-clamp-2">{v.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-neutral-300">
                    <span className="flex items-center gap-1">
                      <IconHeart size={12} /> {v.likes || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <IconMessage size={12} /> {v.comments || 0}
                    </span>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {v.duration}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
