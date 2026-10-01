'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconHeart, IconFlame, IconEye, IconClock, IconX } from '../../components/Icons';
import { getUserId } from '../../lib/uid';
import { hasRejectedFunctional, openCookiePreferences } from '../../lib/consent';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [functionalDisabled, setFunctionalDisabled] = useState(false);

  useEffect(() => {
    const loadFavs = () => {
      if (hasRejectedFunctional()) {
        setFunctionalDisabled(true);
        setFavorites([]);
        setLoaded(true);
        return;
      }
      setFunctionalDisabled(false);

      const uid = getUserId();
      if (!uid) {
        setLoaded(true);
        return;
      }

      // Load from DB first with localStorage fallback
      fetch(`/api/favorites?uid=${encodeURIComponent(uid)}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.favorites) && data.favorites.length > 0) {
            setFavorites(data.favorites);
            try {
              localStorage.setItem('oh_favorites_list', JSON.stringify(data.favorites));
            } catch {}
          } else {
            // Check local storage if DB empty/offline
            try {
              const raw = localStorage.getItem('oh_favorites_list');
              if (raw) setFavorites(JSON.parse(raw));
            } catch {}
          }
        })
        .catch(() => {
          try {
            const raw = localStorage.getItem('oh_favorites_list');
            if (raw) setFavorites(JSON.parse(raw));
          } catch {}
        })
        .finally(() => setLoaded(true));
    };

    loadFavs();

    const onConsentChanged = () => {
      loadFavs();
    };
    window.addEventListener('oh_consent_changed', onConsentChanged);
    return () => window.removeEventListener('oh_consent_changed', onConsentChanged);
  }, []);

  const removeFavorite = async (e, vkey) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = favorites.filter((f) => f.vkey !== vkey);
    setFavorites(updated);
    const uid = getUserId();

    try {
      localStorage.setItem('oh_favorites_list', JSON.stringify(updated));
      localStorage.removeItem(`oh_saved_${vkey}`);
    } catch {}

    if (uid) {
      try {
        await fetch(`/api/favorites?uid=${encodeURIComponent(uid)}&vkey=${encodeURIComponent(vkey)}`, {
          method: 'DELETE',
        });
      } catch {}
    }
  };

  const clearAll = async () => {
    if (!confirm('Are you sure you want to remove all saved favorites?')) return;
    const uid = getUserId();
    const toRemove = [...favorites];

    try {
      favorites.forEach((f) => localStorage.removeItem(`oh_saved_${f.vkey}`));
      localStorage.removeItem('oh_favorites_list');
    } catch {}
    setFavorites([]);

    if (uid) {
      for (const f of toRemove) {
        try {
          await fetch(`/api/favorites?uid=${encodeURIComponent(uid)}&vkey=${encodeURIComponent(f.vkey)}`, {
            method: 'DELETE',
          });
        } catch {}
      }
    }
  };

  if (!loaded) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="h-8 w-48 rounded-lg skeleton mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-xl skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1f1f1f] mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#ff9900]/15 text-[#ff9900]">
              <IconHeart size={26} className="fill-[#ff9900]" />
            </span>
            My Favorites
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            {favorites.length} {favorites.length === 1 ? 'saved video' : 'saved videos'} in your private playlist
          </p>
        </div>

        {favorites.length > 0 && (
          <button
            onClick={clearAll}
            className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-red-950/40 border border-[#2a2a2a] hover:border-red-800 text-xs font-semibold text-neutral-400 hover:text-red-400 transition-colors self-start sm:self-auto cursor-pointer"
          >
            Clear all favorites
          </button>
        )}
      </div>

      {functionalDisabled ? (
        <div className="py-20 text-center max-w-md mx-auto fade-in">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-[#ff9900]">
            <IconHeart size={36} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Favorites are currently disabled</h2>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Enable functional cookies to use favorites, save videos to your private list, and access them anytime.
          </p>
          <button
            type="button"
            onClick={openCookiePreferences}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold text-sm transition-all hover:scale-[1.02] cursor-pointer"
          >
            Enable functional cookies to use this
          </button>
        </div>
      ) : favorites.length === 0 ? (
        <div className="py-20 text-center max-w-md mx-auto fade-in">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-neutral-600">
            <IconHeart size={36} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No favorites yet — tap the heart on any video.</h2>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Click the <span className="text-[#ff9900] font-semibold">Favorite</span> button on any video page to save it here for instant access anytime.
          </p>
          <Link
            href="/list/hottest"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold text-sm transition-all hover:scale-[1.02]"
          >
            <IconFlame size={18} /> Explore Hottest Videos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-7">
          {favorites.map((v, idx) => (
            <div
              key={v.vkey || idx}
              className="group card-in relative flex flex-col bg-[#111] rounded-xl overflow-hidden border border-white/5 hover:border-[#ff9900]/50 transition-all shadow-lg"
              style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}
            >
              <Link href={`/watch/${v.vkey}`} className="block relative aspect-video bg-black overflow-hidden">
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {v.duration && (
                  <span className="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                    {v.duration !== '0:00' && v.duration !== '0' ? v.duration : '--:--'}
                  </span>
                )}
                {/* Remove button */}
                <button
                  onClick={(e) => removeFavorite(e, v.vkey)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 hover:bg-red-600 text-neutral-300 hover:text-white flex items-center justify-center transition-colors shadow-lg opacity-80 group-hover:opacity-100 cursor-pointer"
                  title="Remove from favorites"
                  aria-label="Remove from favorites"
                >
                  <IconX size={14} />
                </button>
              </Link>

              <div className="p-3 flex-1 flex flex-col justify-between">
                <Link
                  href={`/watch/${v.vkey}`}
                  className="clamp-2 text-xs font-bold text-white group-hover:text-[#ff9900] transition-colors leading-snug"
                >
                  {v.title}
                </Link>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-2.5 pt-2 border-t border-[#1a1a1a]">
                  <span className="text-neutral-400 font-medium truncate max-w-[120px]">
                    {v.author || 'Verified Creator'}
                  </span>
                  {v.views && <span>{v.views}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
