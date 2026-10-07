'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconFlame, IconSearch, IconHeart, IconClock } from './Icons';

const ITEMS = [
  { href: '/', label: 'Home', icon: IconHome, match: (p) => p === '/' },
  { href: '/list/hottest', label: 'Hottest', icon: IconFlame, match: (p) => p === '/list/hottest' },
  { href: '/favorites', label: 'Favorites', icon: IconHeart, match: (p) => p === '/favorites' },
  { href: '/history', label: 'History', icon: IconClock, match: (p) => p === '/history' },
];

export default function MobileBottomNav() {
  const pathname = usePathname() || '/';

  const focusSearch = () => {
    window.dispatchEvent(new Event('oh_focus_search'));
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-t border-[#1f1f1f] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-[64px]">
        {ITEMS.slice(0, 2).map((item) => (
          <BottomLink key={item.href} item={item} active={item.match(pathname)} />
        ))}

        {/* Center search button */}
        <button
          type="button"
          onClick={focusSearch}
          aria-label="Search"
          className="flex flex-col items-center justify-center gap-1 text-neutral-400 active:text-[#ff9900] transition-colors cursor-pointer"
        >
          <span className="w-11 h-11 -mt-5 rounded-full bg-[#ff9900] text-black flex items-center justify-center shadow-lg shadow-[#ff9900]/30 active:scale-95 transition-transform">
            <IconSearch size={20} />
          </span>
          <span className="text-[10px] font-bold">Search</span>
        </button>

        {ITEMS.slice(2).map((item) => (
          <BottomLink key={item.href} item={item} active={item.match(pathname)} />
        ))}
      </div>
    </nav>
  );
}

function BottomLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
        active ? 'text-[#ff9900]' : 'text-neutral-400 active:text-[#ff9900]'
      }`}
    >
      {active && <span className="absolute top-1.5 w-1 h-1 rounded-full bg-[#ff9900]" />}
      <Icon size={22} className={active ? 'drop-shadow-[0_0_6px_rgba(255,153,0,0.6)]' : ''} />
      <span className="text-[10px] font-bold">{item.label}</span>
    </Link>
  );
}
