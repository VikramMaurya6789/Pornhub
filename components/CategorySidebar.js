'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  IconHome,
  IconFlame,
  IconEye,
  IconStar,
  IconSparkles,
  IconGrid,
  IconTag,
  IconSearch,
  IconChevronR,
  IconX,
  IconHeart,
  IconBadgeCheck,
} from './Icons';
import { formatCount } from '../lib/format';

// Popular curated default categories for instant zero-lag display
const DEFAULT_CATEGORIES = [
  { name: 'Amateur', slug: '/video?c=3', count: '561K' },
  { name: 'Verified Amateurs', slug: '/video?c=138', count: '769K' },
  { name: 'Solo Female', slug: '/video?c=492', count: '279K' },
  { name: 'Big Dick', slug: '/video?c=7', count: '246K' },
  { name: 'Masturbation', slug: '/video?c=22', count: '186K' },
  { name: 'POV', slug: '/video?c=41', count: '180K' },
  { name: 'Anal', slug: '/video?c=35', count: '150K' },
  { name: 'MILF', slug: '/video?c=28', count: '140K' },
  { name: 'Japanese', slug: '/video?c=111', count: '135K' },
  { name: 'Small Tits', slug: '/video?c=59', count: '128K' },
  { name: '60FPS', slug: '/video?c=105', count: '126K' },
  { name: 'Blowjob', slug: '/video?c=8', count: '120K' },
  { name: 'Teen (18+)', slug: '/categories/teen', count: '311K' },
  { name: 'Toys', slug: '/video?c=23', count: '113K' },
  { name: 'Creampie', slug: '/video?c=14', count: '95K' },
  { name: 'Asian', slug: '/video?c=1', count: '88K' },
  { name: 'Reality', slug: '/video?c=31', count: '86K' },
  { name: 'BBW', slug: '/video?c=6', count: '64K' },
  { name: 'Tattooed Women', slug: '/video?c=562', count: '62K' },
  { name: 'Threesome', slug: '/video?c=65', count: '42K' },
  { name: 'Ebony', slug: '/video?c=17', count: '49K' },
  { name: 'VR', slug: '/vr', count: '4.8K' },
];

const TRENDING_TAGS = [
  'amateur', 'pov', 'creampie', 'milf', 'threesome',
  'teen', 'verified', 'asian', 'latina', 'anal', 'ebony', 'blowjob'
];

function CategorySidebarInner({ className = '' }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentSlug = sp.get('slug') || '';

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const list = await res.json();
          if (active && Array.isArray(list) && list.length > 0) {
            setCategories(list.map(c => ({
              name: c.name,
              slug: c.slug,
              count: c.count ? formatCount(c.count.replace(/\s*Videos?/i, '')) : null,
              thumbnail: c.thumbnail,
            })));
          }
        }
      } catch { /* use defaults */ }
    })();
    return () => { active = false; };
  }, []);

  const filteredCategories = useMemo(() => {
    if (!filter.trim()) return categories;
    const q = filter.toLowerCase().trim();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, filter]);

  const displayedCategories = useMemo(() => {
    if (filter.trim() || expanded) return filteredCategories;
    return filteredCategories.slice(0, 15);
  }, [filteredCategories, filter, expanded]);

  const navLinks = [
    { href: '/', label: 'Home', icon: IconHome },
    { href: '/list/hottest', label: 'Hottest', icon: IconFlame },
    { href: '/list/most_viewed', label: 'Most Viewed', icon: IconEye },
    { href: '/list/top_rated', label: 'Top Rated', icon: IconStar },
    { href: '/list/newest', label: 'Newest', icon: IconSparkles },
    { href: '/models', label: 'Models', icon: IconBadgeCheck },
    { href: '/favorites', label: 'Favorites', icon: IconHeart },
  ];

  return (
    <aside className={`w-[260px] shrink-0 hidden lg:block ${className}`}>
      <div className="sticky top-20 bg-[#0e0e0e] border border-[#1f1f1f] rounded-2xl p-4 shadow-xl max-h-[calc(100vh-6rem)] overflow-y-auto space-y-5">
        
        {/* Main Feeds Navigation */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2 px-2.5">
            Feeds
          </div>
          <nav className="space-y-1">
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#ff9900] text-black font-semibold shadow-md shadow-[#ff9900]/20'
                      : 'text-neutral-300 hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-black' : 'text-neutral-400'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="h-[1px] bg-[#1c1c1c]" />

        {/* Categories Section */}
        <div>
          <div className="flex items-center justify-between px-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <IconGrid size={16} className="text-[#ff9900]" />
              <span className="text-[12px] font-bold uppercase tracking-wider text-neutral-300">
                Categories
              </span>
            </div>
            <Link
              href="/categories"
              className="text-[11px] font-semibold text-[#ff9900] hover:text-[#ffb340] transition-colors"
            >
              All ({categories.length})
            </Link>
          </div>

          {/* Quick filter input */}
          <div className="relative mb-3">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter categories..."
              className="w-full bg-[#161616] border border-[#262626] focus:border-[#ff9900] rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
            />
            {filter && (
              <button
                onClick={() => setFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <IconX size={12} />
              </button>
            )}
          </div>

          {/* Categories List */}
          <div className="space-y-0.5">
            {displayedCategories.map((c) => {
              const isCatActive = currentSlug === c.slug;
              return (
                <Link
                  key={c.slug}
                  href={`/category?slug=${encodeURIComponent(c.slug)}`}
                  className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    isCatActive
                      ? 'bg-[#ff9900]/15 text-[#ff9900] font-semibold'
                      : 'text-neutral-300 hover:bg-[#191919] hover:text-white'
                  }`}
                >
                  <span className="truncate group-hover:text-[#ff9900] transition-colors">
                    {c.name}
                  </span>
                  {c.count && (
                    <span className="ml-2 text-[10px] text-neutral-500 group-hover:text-neutral-400 font-mono">
                      {formatCount(c.count)}
                    </span>
                  )}
                </Link>
              );
            })}

            {displayedCategories.length === 0 && (
              <p className="text-xs text-neutral-500 px-3 py-2 text-center">
                No matching category
              </p>
            )}
          </div>

          {/* Expand / Collapse Button */}
          {!filter && categories.length > 15 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2.5 w-full py-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] text-[11px] font-semibold text-neutral-400 hover:text-white transition-colors flex items-center justify-center gap-1 border border-[#222]"
            >
              {expanded ? (
                'Show Less'
              ) : (
                <>
                  <span>Show More ({categories.length - 15}+)</span>
                  <IconChevronR size={12} className="rotate-90" />
                </>
              )}
            </button>
          )}
        </div>

        <div className="h-[1px] bg-[#1c1c1c]" />

        {/* Trending Tags Section */}
        <div>
          <div className="flex items-center gap-2 px-2.5 mb-2.5">
            <IconTag size={15} className="text-[#ff9900]" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-neutral-300">
              Trending Tags
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 px-1">
            {TRENDING_TAGS.map((tag) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}`}
                className="px-2.5 py-1 rounded-md bg-[#161616] hover:bg-[#ff9900] text-neutral-300 hover:text-black text-[11px] font-medium border border-[#262626] transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </aside>
  );
}

export default function CategorySidebar(props) {
  return (
    <Suspense fallback={<aside className="w-[260px] shrink-0 hidden lg:block" />}>
      <CategorySidebarInner {...props} />
    </Suspense>
  );
}

/**
 * MobileCategoryChips — Horizontal scrolling chip bar for mobile / small screens
 */
function MobileCategoryChipsInner() {
  const sp = useSearchParams();
  const currentSlug = sp.get('slug') || '';

  return (
    <div className="lg:hidden mb-5 -mx-4 px-4 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 pb-1 min-w-max">
        <Link
          href="/"
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            !currentSlug
              ? 'bg-[#ff9900] text-black'
              : 'bg-[#1a1a1a] text-neutral-300 hover:bg-[#252525] hover:text-white border border-[#2c2c2c]'
          }`}
        >
          All Videos
        </Link>
        {DEFAULT_CATEGORIES.slice(0, 16).map((cat) => {
          const isActive = currentSlug === cat.slug;
          return (
            <Link
              key={cat.slug}
              href={`/category?slug=${encodeURIComponent(cat.slug)}`}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#ff9900] text-black font-semibold'
                  : 'bg-[#1a1a1a] text-neutral-300 hover:bg-[#252525] hover:text-white border border-[#2a2a2a]'
              }`}
            >
              {cat.name}
            </Link>
          );
        })}
        <Link
          href="/categories"
          className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-[#141414] text-[#ff9900] border border-[#ff9900]/40 hover:bg-[#ff9900] hover:text-black transition-colors"
        >
          More Categories →
        </Link>
      </div>
    </div>
  );
}

export function MobileCategoryChips() {
  return (
    <Suspense fallback={null}>
      <MobileCategoryChipsInner />
    </Suspense>
  );
}
