'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LibraryNav from '../../components/LibraryNav';
import VideoCard, { VideoGridSkeleton } from '../../components/VideoCard';
import { IconStar, IconCheck, IconX, IconPlay } from '../../components/Icons';

const SUGGESTED_STARS = [
  { name: 'Mia Khalifa', slug: 'mia-khalifa', avatar: '/api/avatar?name=Mia%20Khalifa' },
  { name: 'Sweetie Fox', slug: 'sweetie-fox', avatar: '/api/avatar?name=Sweetie%20Fox' },
  { name: 'Eva Elfie', slug: 'eva-elfie', avatar: '/api/avatar?name=Eva%20Elfie' },
  { name: 'Angela White', slug: 'angela-white', avatar: '/api/avatar?name=Angela%20White' },
  { name: 'Abella Danger', slug: 'abella-danger', avatar: '/api/avatar?name=Abella%20Danger' },
  { name: 'Hazel Moore', slug: 'hazel-moore', avatar: '/api/avatar?name=Hazel%20Moore' },
  { name: 'Lana Rhoades', slug: 'lana-rhoades', avatar: '/api/avatar?name=Lana%20Rhoades' },
  { name: 'Riley Reid', slug: 'riley-reid', avatar: '/api/avatar?name=Riley%20Reid' },
];

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [activeStar, setActiveStar] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadSubs = () => {
    try {
      const raw = localStorage.getItem('oh_subscriptions');
      const list = raw ? JSON.parse(raw) : [];
      setSubs(Array.isArray(list) ? list : []);
    } catch {
      setSubs([]);
    }
  };

  useEffect(() => {
    loadSubs();
    window.addEventListener('oh_subscriptions_changed', loadSubs);
    return () => window.removeEventListener('oh_subscriptions_changed', loadSubs);
  }, []);

  // Fetch videos for subscriptions
  useEffect(() => {
    if (subs.length === 0) {
      setVideos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const targetSlug = activeStar === 'all' ? subs[0].slug : activeStar;

    fetch(`/api/pornstar?slug=${encodeURIComponent(targetSlug)}`)
      .then((r) => r.json())
      .then((data) => {
        setVideos(Array.isArray(data?.videos) ? data.videos : []);
      })
      .catch(() => {
        setVideos([]);
      })
      .finally(() => setLoading(false));
  }, [subs, activeStar]);

  const toggleFollow = (star) => {
    try {
      const raw = localStorage.getItem('oh_subscriptions');
      const list = raw ? JSON.parse(raw) : [];
      const exists = list.some((s) => s.slug === star.slug);
      let updated;
      if (exists) {
        updated = list.filter((s) => s.slug !== star.slug);
      } else {
        updated = [...list, { slug: star.slug, name: star.name, avatar: star.avatar || `/api/avatar?name=${encodeURIComponent(star.name)}` }];
      }
      localStorage.setItem('oh_subscriptions', JSON.stringify(updated));
      setSubs(updated);
      window.dispatchEvent(new CustomEvent('oh_subscriptions_changed'));
    } catch {}
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <LibraryNav />

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
          <span className="w-11 h-11 rounded-xl bg-[#ff9900]/10 border border-[#ff9900]/20 flex items-center justify-center text-[#ff9900]">
            <IconStar size={22} />
          </span>
          <span>My Subscriptions</span>
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Stay updated with newly uploaded 10+ minute full length videos from your favorite pornstars.
        </p>
      </div>

      {subs.length === 0 ? (
        <div className="space-y-10">
          <div className="text-center py-16 px-4 bg-[#121212] border border-[#222] rounded-3xl max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-[#1c1c1c] text-[#ff9900] flex items-center justify-center mx-auto mb-4">
              <IconStar size={32} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No subscriptions yet</h3>
            <p className="text-sm text-neutral-400 mb-2">
              Follow your favorite stars to get their latest full-length videos in your personalized feed.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <IconStar size={18} className="text-[#ff9900]" />
              <span>Recommended Stars to Follow</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {SUGGESTED_STARS.map((star) => (
                <div
                  key={star.slug}
                  className="bg-[#141414] border border-[#222] rounded-2xl p-3 flex flex-col items-center text-center hover:border-[#ff9900]/50 transition-all"
                >
                  <img
                    src={star.avatar}
                    alt={star.name}
                    className="w-16 h-16 rounded-full object-cover mb-2 ring-2 ring-[#ff9900]/30"
                    onError={(e) => {
                      e.currentTarget.src = `/api/avatar?name=${encodeURIComponent(star.name)}`;
                    }}
                  />
                  <span className="text-xs font-bold text-white truncate max-w-full mb-3">
                    {star.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleFollow(star)}
                    className="w-full py-1.5 rounded-xl bg-[#ff9900] text-black font-bold text-xs hover:bg-[#ffa826] transition-colors cursor-pointer"
                  >
                    + Follow
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subscribed Stars Carousel / Row */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveStar('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeStar === 'all'
                  ? 'bg-[#ff9900] text-black'
                  : 'bg-[#181818] text-neutral-300 hover:bg-[#252525]'
              }`}
            >
              All Stars ({subs.length})
            </button>

            {subs.map((s) => (
              <div
                key={s.slug}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border transition-all ${
                  activeStar === s.slug
                    ? 'bg-[#1a1a1a] border-[#ff9900] text-white shadow-sm'
                    : 'bg-[#141414] border-[#222] text-neutral-400 hover:text-white'
                }`}
              >
                <img
                  src={s.avatar || `/api/avatar?name=${encodeURIComponent(s.name)}`}
                  alt={s.name}
                  className="w-6 h-6 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `/api/avatar?name=${encodeURIComponent(s.name)}`;
                  }}
                />
                <button
                  type="button"
                  onClick={() => setActiveStar(s.slug)}
                  className="font-bold hover:text-[#ff9900] cursor-pointer"
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFollow(s)}
                  className="text-neutral-500 hover:text-red-400 ml-1 cursor-pointer"
                  title="Unfollow"
                >
                  <IconX size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Videos Grid */}
          {loading ? (
            <VideoGridSkeleton n={12} />
          ) : videos.length === 0 ? (
            <div className="text-center py-16 px-4 bg-[#121212] border border-[#222] rounded-3xl">
              <p className="text-neutral-400 text-sm">No videos found for this subscription.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-7">
              {videos.map((v, i) => (
                <VideoCard key={v.vkey || i} v={v} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
