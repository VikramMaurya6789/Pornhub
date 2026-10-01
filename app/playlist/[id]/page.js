'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getUserId } from '../../../lib/uid';
import VideoCard, { VideoGridSkeleton } from '../../../components/VideoCard';
import {
  IconList,
  IconPlay,
  IconShare,
  IconCheck,
  IconGlobe,
  IconLock,
  IconTrash,
  IconAlert,
  IconSparkles,
} from '../../../components/Icons';

export default function PlaylistDetailsPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams?.id;

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const fetchPlaylist = async () => {
    if (!id) return;
    const uid = getUserId();
    try {
      setLoading(true);
      const res = await fetch(`/api/playlists/${id}?uid=${encodeURIComponent(uid || '')}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load playlist');
      }
      setPlaylist(data.playlist);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, [id]);

  const copyShareLink = () => {
    const url = window.location.href;
    try {
      navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('Public share link copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Failed to copy link');
    }
  };

  const removeItem = async (vkey) => {
    try {
      const res = await fetch(`/api/playlists/${id}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vkey }),
      });
      if (res.ok) {
        setPlaylist((prev) => ({
          ...prev,
          items: (prev.items || []).filter((it) => it.vkey !== vkey),
        }));
        showToast('Video removed from playlist');
      }
    } catch {
      showToast('Failed to remove video');
    }
  };

  const isOwner = playlist && getUserId() && playlist.userId === getUserId();
  const items = playlist?.items || [];
  const firstVideo = items[0] || null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#ff9900] text-black font-bold text-sm px-4 py-2.5 rounded-xl shadow-xl fade-in">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="h-28 rounded-2xl skeleton max-w-xl" />
          <VideoGridSkeleton n={12} />
        </div>
      ) : error ? (
        <div className="bg-[#141414] border border-white/5 rounded-2xl p-12 text-center max-w-lg mx-auto my-12">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
            <IconAlert size={30} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Playlist Unavailable</h2>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            {error || 'This playlist is private or has been removed by its creator.'}
          </p>
          <Link
            href="/playlists"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff9900] text-black font-bold text-sm hover:bg-[#ffa826] transition-colors"
          >
            <IconList size={16} />
            <span>Go to My Playlists</span>
          </Link>
        </div>
      ) : playlist ? (
        <div>
          {/* Header Banner */}
          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded bg-[#ff9900]/15 text-[#ff9900] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <IconList size={13} />
                  Playlist
                </span>
                <span className="px-2 py-0.5 rounded bg-black/60 text-neutral-400 text-xs font-medium border border-white/5 flex items-center gap-1">
                  {playlist.isPublic ? <IconGlobe size={12} className="text-[#ff9900]" /> : <IconLock size={12} />}
                  {playlist.isPublic ? 'Public' : 'Private'}
                </span>
              </div>

              <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
                {playlist.name}
              </h1>

              <p className="text-sm text-neutral-400">
                {items.length} {items.length === 1 ? 'video' : 'videos'} • Created{' '}
                {new Date(playlist.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {firstVideo && (
                <Link
                  href={`/watch/${firstVideo.vkey}`}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ff9900] hover:bg-[#ffa826] text-black font-bold text-sm transition-all shadow-lg shadow-[#ff9900]/20 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <IconPlay size={18} />
                  <span>Play All</span>
                </Link>
              )}

              {playlist.isPublic && (
                <button
                  onClick={copyShareLink}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1c1c1c] hover:bg-[#282828] text-neutral-200 hover:text-white font-semibold text-sm border border-white/10 transition-colors cursor-pointer"
                >
                  {copied ? <IconCheck size={16} className="text-[#ff9900]" /> : <IconShare size={16} />}
                  <span>{copied ? 'Link Copied' : 'Share Playlist'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Videos Grid */}
          {items.length === 0 ? (
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-12 text-center max-w-md mx-auto my-8">
              <p className="text-sm text-neutral-400 mb-4">No videos in this playlist yet.</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff9900] text-black font-bold text-sm hover:bg-[#ffa826] transition-colors"
              >
                <IconSparkles size={16} />
                <span>Browse Videos</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-7">
              {items.map((it, idx) => (
                <div key={it.id || it.vkey} className="relative group/item">
                  <VideoCard
                    v={{
                      vkey: it.vkey,
                      title: it.title || 'Video',
                      thumbnail: it.thumbnail,
                    }}
                    index={idx}
                  />

                  {/* Remove button for owner */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeItem(it.vkey);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute top-2 left-2 z-30 p-1.5 rounded-full bg-black/80 hover:bg-red-600 text-neutral-300 hover:text-white opacity-0 group-hover/item:opacity-100 transition-opacity shadow-md cursor-pointer"
                      title="Remove from playlist"
                      aria-label="Remove from playlist"
                    >
                      <IconTrash size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
