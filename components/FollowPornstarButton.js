'use client';
import { useState, useEffect } from 'react';
import { IconStar, IconCheck } from './Icons';

export default function FollowPornstarButton({ slug, name, avatar }) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('oh_subscriptions');
      const list = raw ? JSON.parse(raw) : [];
      setFollowing(list.some((s) => s.slug === slug));
    } catch {}

    const onSubsChanged = () => {
      try {
        const raw = localStorage.getItem('oh_subscriptions');
        const list = raw ? JSON.parse(raw) : [];
        setFollowing(list.some((s) => s.slug === slug));
      } catch {}
    };
    window.addEventListener('oh_subscriptions_changed', onSubsChanged);
    return () => window.removeEventListener('oh_subscriptions_changed', onSubsChanged);
  }, [slug]);

  const toggleFollow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const raw = localStorage.getItem('oh_subscriptions');
      const list = raw ? JSON.parse(raw) : [];
      const exists = list.some((s) => s.slug === slug);
      let updated;
      if (exists) {
        updated = list.filter((s) => s.slug !== slug);
      } else {
        updated = [...list, { slug, name, avatar }];
      }
      localStorage.setItem('oh_subscriptions', JSON.stringify(updated));
      setFollowing(!exists);
      window.dispatchEvent(new CustomEvent('oh_subscriptions_changed'));
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggleFollow}
      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 ${
        following
          ? 'bg-[#182418] border border-green-600/70 text-green-400 hover:border-red-600/60 hover:text-red-400'
          : 'bg-[#ff9900] text-black hover:bg-[#ffa826]'
      }`}
    >
      {following ? (
        <>
          <IconCheck size={14} className="stroke-[3]" />
          <span>Following</span>
        </>
      ) : (
        <>
          <IconStar size={14} className="fill-black" />
          <span>+ Follow Star</span>
        </>
      )}
    </button>
  );
}
