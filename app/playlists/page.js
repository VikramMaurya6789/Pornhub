'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUserId } from '../../lib/uid';
import {
  IconList,
  IconPlus,
  IconTrash,
  IconGlobe,
  IconLock,
  IconPlay,
  IconSparkles,
} from '../../components/Icons';
import { hasRejectedFunctional, openCookiePreferences } from '../../lib/consent';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [functionalDisabled, setFunctionalDisabled] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const fetchPlaylists = async () => {
    if (hasRejectedFunctional()) {
      setFunctionalDisabled(true);
      setPlaylists([]);
      setLoading(false);
      return;
    }
    setFunctionalDisabled(false);

    const uid = getUserId();
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/playlists?uid=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylists(Array.isArray(data.playlists) ? data.playlists : []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();

    const onConsentChanged = () => {
      fetchPlaylists();
    };
    window.addEventListener('oh_consent_changed', onConsentChanged);
    return () => window.removeEventListener('oh_consent_changed', onConsentChanged);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (hasRejectedFunctional()) {
      openCookiePreferences();
      return;
    }
    const title = newTitle.trim();
    if (!title) return;
    const uid = getUserId();
    if (!uid) return;

    try {
      setCreating(true);
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, name: title, isPublic }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewTitle('');
        setPlaylists((prev) => [data.playlist, ...prev]);
        showToast('Playlist created successfully');
      } else {
        showToast('Failed to create playlist');
      }
    } catch {
      showToast('Error creating playlist');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent?.stopImmediatePropagation) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }

    // Delete on the server first so the UI never lies about the outcome
    const uid = getUserId();
    let serverOk = false;
    let gone = false;
    try {
      const res = await fetch(`/api/playlists/${id}?uid=${encodeURIComponent(uid || '')}`, {
        method: 'DELETE',
      });
      serverOk = res.ok;
      gone = res.status === 404;
    } catch {}

    if (serverOk || gone) {
      // Remove from UI and legacy local storage only after the server confirms
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      showToast('Playlist deleted');

      try {
        const raw = localStorage.getItem('oh_playlists');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            localStorage.setItem('oh_playlists', JSON.stringify(list.filter((p) => p.id !== id)));
          }
        }
      } catch {}
    } else {
      showToast('Could not delete playlist — please try again');
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#ff9900] text-black font-bold text-sm px-4 py-2.5 rounded-xl shadow-xl fade-in">
          {toast}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
            <span className="w-11 h-11 rounded-xl bg-[#ff9900]/10 border border-[#ff9900]/20 flex items-center justify-center text-[#ff9900]">
              <IconList size={22} />
            </span>
            <span>My Playlists</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Organize and collect your favorite videos into custom lists
          </p>
        </div>

        {/* Create playlist quick form */}
        {!functionalDisabled && (
          <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="New playlist name..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="bg-[#181818] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9900] min-w-[200px]"
            />
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                isPublic
                  ? 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-500'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800'
              }`}
              title={isPublic ? 'Public playlist (shareable)' : 'Private playlist'}
            >
              {isPublic ? <IconGlobe size={14} className="text-[#ff9900]" /> : <IconLock size={14} />}
              <span>{isPublic ? 'Public' : 'Private'}</span>
            </button>
            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff9900] hover:bg-[#ffa826] text-black font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer shadow-md"
            >
              <IconPlus size={16} />
              <span>Create</span>
            </button>
          </form>
        )}
      </div>

      {functionalDisabled ? (
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-12 text-center max-w-xl mx-auto my-12 fade-in">
          <div className="w-16 h-16 rounded-full bg-[#ff9900]/10 border border-[#ff9900]/30 flex items-center justify-center mx-auto mb-4 text-[#ff9900]">
            <IconList size={30} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Playlists are currently disabled</h2>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Enable functional cookies to create custom playlists, organize saved videos, and access your collections anytime.
          </p>
          <button
            type="button"
            onClick={openCookiePreferences}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ff9900] hover:bg-[#ffa826] text-black font-bold text-sm transition-all hover:scale-[1.02] cursor-pointer"
          >
            Enable functional cookies to use this
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-xl skeleton" />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-12 text-center max-w-xl mx-auto my-12">
          <div className="w-16 h-16 rounded-full bg-[#ff9900]/10 border border-[#ff9900]/30 flex items-center justify-center mx-auto mb-4 text-[#ff9900]">
            <IconList size={30} />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No playlists yet</h2>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Create your first playlist using the form above, or click &ldquo;Save to playlist&rdquo; on any video watch page to begin organizing.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff9900] hover:bg-[#ffa826] text-black font-bold text-sm transition-colors"
          >
            <IconSparkles size={16} />
            <span>Discover Videos</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {playlists.map((pl) => {
            const count = pl._count?.items ?? pl.items?.length ?? 0;
            const thumbs = (pl.items || []).slice(0, 4).map((it) => it.thumbnail).filter(Boolean);
            const coverThumb = thumbs[0] || null;

            return (
              <Link
                key={pl.id}
                href={`/playlist/${pl.id}`}
                className="group block relative bg-[#141414] rounded-2xl overflow-hidden border border-white/5 hover:border-[#ff9900]/50 transition-all duration-300 shadow-lg hover:shadow-[#ff9900]/10"
              >
                {/* Playlist Thumbnail Cover */}
                <div className="aspect-video relative overflow-hidden bg-black/60 flex items-center justify-center">
                  {coverThumb ? (
                    <img
                      src={coverThumb}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] text-neutral-500">
                      <IconList size={36} className="text-[#ff9900]/60 mb-1" />
                      <span className="text-[11px] font-semibold">Empty Playlist</span>
                    </div>
                  )}

                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  {/* Badge video count */}
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/85 text-xs text-white font-semibold flex items-center gap-1">
                    <IconList size={12} className="text-[#ff9900]" />
                    <span>{count} {count === 1 ? 'video' : 'videos'}</span>
                  </div>

                  {/* Privacy badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-neutral-300 font-semibold flex items-center gap-1 border border-white/10">
                    {pl.isPublic ? <IconGlobe size={11} className="text-[#ff9900]" /> : <IconLock size={11} />}
                    <span>{pl.isPublic ? 'Public' : 'Private'}</span>
                  </div>

                  {/* Hover play action */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <div className="w-12 h-12 rounded-full bg-[#ff9900] text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                      <IconPlay size={20} className="ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-base truncate group-hover:text-[#ff9900] transition-colors">
                      {pl.name}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      Created {new Date(pl.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(pl.id, e)}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors shrink-0 z-30 relative cursor-pointer"
                    title="Delete playlist"
                    aria-label="Delete playlist"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
