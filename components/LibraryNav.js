'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHeart, IconClock, IconStar, IconTag } from './Icons';

export default function LibraryNav() {
  const pathname = usePathname();

  const TABS = [
    { href: '/favorites', label: 'Favorites', icon: IconHeart },
    { href: '/liked', label: 'Liked Videos', icon: IconHeart },
    { href: '/history', label: 'Watch History', icon: IconClock },
    { href: '/subscriptions', label: 'My Subscriptions', icon: IconStar },
    { href: '/playlists', label: 'Playlists', icon: IconTag },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#222] mb-8 no-scrollbar">
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              active
                ? 'bg-[#ff9900] text-black shadow-md font-bold'
                : 'bg-[#161616] text-neutral-400 hover:text-white hover:bg-[#222]'
            }`}
          >
            <Icon size={16} className={active ? 'text-black' : 'text-neutral-400'} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
