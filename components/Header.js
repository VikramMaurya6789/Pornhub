'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconSearch, IconHome, IconFlame, IconEye, IconStar, IconGrid,
  IconMenu, IconX, IconHeart, IconClock, IconTag, IconSparkles, IconHistory
} from './Icons';
import AuthModal from './AuthModal';
import { fetchMe, getCachedUser, openAuthModal, signOut as authSignOut, subscribeAuth } from '../lib/auth-client';

const NAV = [
  { href: '/', label: 'Home', icon: IconHome },
  { href: '/list/hottest', label: 'Hottest', icon: IconFlame },
  { href: '/list/newest', label: 'New', icon: IconSparkles },
  { href: '/list/most_viewed', label: 'Most Viewed', icon: IconEye },
  { href: '/list/top_rated', label: 'Top Rated', icon: IconStar },
  { href: '/categories', label: 'Categories', icon: IconGrid },
  { href: '/models', label: 'Stars', icon: IconStar },
  { href: '/subscriptions', label: 'Subscriptions', icon: IconStar },
  { href: '/favorites', label: 'Favorites', icon: IconHeart },
  { href: '/liked', label: 'Liked', icon: IconHeart },
  { href: '/history', label: 'History', icon: IconClock },
];

const TRENDING_SUGGESTIONS = [
  'Amateur', 'POV', 'Threesome', 'Japanese', 'MILF', 'Blowjob',
  'Lesbian', 'Anal', 'Verified Amateurs', 'College', 'Brunette',
  'Blonde', 'Rough', 'Creampie', 'Sweetie Fox', 'Porn Force', 'Alex Adams'
];

export function Logo({ size = 'md' }) {
  const big = size === 'lg';
  return (
    <Link href="/" className="flex items-center shrink-0 select-none gap-2.5 group" aria-label="OrangeHub home">
      <img
        src="/apple-touch-icon.png"
        alt="OrangeHub"
        className={`rounded-lg object-contain transition-transform group-hover:scale-105 ${big ? 'w-10 h-10 ring-2 ring-[#ff9900]/40' : 'w-7 h-7 ring-1 ring-[#ff9900]/30'}`}
      />
      <div className="flex items-center">
        <span className={`font-black tracking-tight text-white ${big ? 'text-4xl' : 'text-2xl'}`}>Orange</span>
        <span className={`font-black tracking-tight text-black bg-[#ff9900] rounded-md ${big ? 'text-4xl px-3 py-1 ml-1' : 'text-2xl px-2 py-0.5 ml-1'}`}>hub</span>
      </div>
    </Link>
  );
}

export default function Header() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [user, setUser] = useState(undefined); // undefined = loading, null = guest
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const router = useRouter();

  // Auth state
  useEffect(() => {
    setUser(getCachedUser() === undefined ? undefined : getCachedUser());
    fetchMe();
    return subscribeAuth(() => setUser(getCachedUser()));
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e) => {
      if (e.target && e.target.closest && !e.target.closest('.auth-menu-container')) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [userMenuOpen]);

  // Load recent searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem('oh_recent_searches');
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  // Handle outside clicks to close autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goSearch = (queryStr) => {
    const target = (queryStr || q).trim();
    if (!target) return;

    // Save to recents
    try {
      const filtered = recentSearches.filter((s) => s.toLowerCase() !== target.toLowerCase());
      const next = [target, ...filtered].slice(0, 8);
      setRecentSearches(next);
      localStorage.setItem('oh_recent_searches', JSON.stringify(next));
    } catch {}

    setSearchFocused(false);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(target)}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    goSearch();
  };

  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  // Debounced 200ms fetch from /api/suggest?q=
  useEffect(() => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSuggestions([]);
      setActiveSuggestion(-1);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setActiveSuggestion(-1);
        }
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [q]);

  const handleKeyDown = (e) => {
    if (!suggestions.length || !searchFocused) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        e.preventDefault();
        goSearch(suggestions[activeSuggestion]);
      }
    } else if (e.key === 'Escape') {
      setSearchFocused(false);
    }
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1f1f1f]">
      <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center gap-4">
        <button
          className="lg:hidden p-2.5 text-neutral-300 hover:text-[#ff9900] transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <IconX size={24} /> : <IconMenu size={24} />}
        </button>

        <Logo />

        {/* Desktop Search Bar with Autocomplete Dropdown */}
        <div className="hidden md:block flex-1 max-w-xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search videos, models, categories..."
              className="w-full bg-[#1c1c1c] border border-[#2c2c2c] focus:border-[#ff9900] rounded-full pl-5 pr-12 py-2.5 text-sm text-white placeholder-neutral-500 outline-none transition-colors"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#ff9900] hover:bg-[#e68a00] text-black flex items-center justify-center transition-colors"
            >
              <IconSearch size={18} />
            </button>
          </form>

          {/* Autocomplete Suggestions Dropdown (debounced, keyboard navigable, hidden on empty query) */}
          {searchFocused && q.trim() && suggestions.length > 0 && (
            <div className="drop-in absolute left-0 right-0 top-12 z-50 bg-[#141414] border border-[#2a2a2a] rounded-2xl p-2 shadow-2xl space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 py-1 px-3 flex items-center gap-1.5">
                <IconSparkles size={12} className="text-[#ff9900]" />
                Suggestions
              </div>
              {suggestions.map((item, idx) => (
                <button
                  key={item}
                  type="button"
                  onMouseEnter={() => setActiveSuggestion(idx)}
                  onClick={() => goSearch(item)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left transition-colors font-medium cursor-pointer ${
                    activeSuggestion === idx
                      ? 'bg-[#ff9900] text-black font-bold'
                      : 'text-neutral-200 hover:bg-[#1f1f1f]'
                  }`}
                >
                  <IconSearch size={14} className={activeSuggestion === idx ? 'text-black' : 'text-neutral-500 shrink-0'} />
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-2 ml-auto">
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-neutral-300 hover:text-white hover:bg-[#1c1c1c] transition-colors whitespace-nowrap shrink-0"
              >
                <n.icon size={15} />
                <span>{n.label}</span>
              </Link>
            ))}
          </nav>

          {/* Auth: Sign In button or user menu */}
          <div className="flex items-center pl-2 ml-1 border-l border-white/10">
            {user ? (
              <div className="relative auth-menu-container">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-label="Account menu"
                  className="w-11 h-11 rounded-full bg-[#ff9900] hover:bg-[#ffa826] text-black font-black text-lg flex items-center justify-center transition-colors cursor-pointer shadow-md shadow-[#ff9900]/20"
                >
                  {(user.name || user.email || 'U').trim().charAt(0).toUpperCase()}
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-[52px] z-50 w-64 bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden fade-in">
                    <div className="px-4 py-3.5 border-b border-[#222]">
                      <p className="text-sm font-bold text-white truncate">{user.name || 'Member'}</p>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{user.email}</p>
                    </div>
                    <div className="p-1.5">
                      {[
                        { href: '/watchlater', label: 'Watch Later', icon: IconClock },
                        { href: '/favorites', label: 'Favorites', icon: IconHeart },
                        { href: '/history', label: 'Watch History', icon: IconHistory },
                        { href: '/playlists', label: 'Playlists', icon: IconTag },
                      ].map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-sm text-neutral-300 hover:text-white hover:bg-[#1f1f1f] transition-colors"
                        >
                          <l.icon size={16} className="text-neutral-500" />
                          {l.label}
                        </Link>
                      ))}
                    </div>
                    <div className="p-1.5 border-t border-[#222]">
                      <button
                        type="button"
                        onClick={async () => {
                          setUserMenuOpen(false);
                          await authSignOut();
                        }}
                        className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-sm font-bold text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                      >
                        <IconX size={16} />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : user === null ? (
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="flex items-center gap-2 px-5 min-h-[44px] rounded-xl bg-[#ff9900] hover:bg-[#ffa826] text-black text-sm font-black shadow-md shadow-[#ff9900]/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <IconUser size={16} />
                Sign In
              </button>
            ) : null}
          </div>
        </div>

        <div className="lg:hidden ml-auto flex items-center gap-2">
          {user ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Account menu"
              className="w-10 h-10 rounded-full bg-[#ff9900] text-black font-black flex items-center justify-center cursor-pointer"
              title={user.email}
            >
              {(user.name || user.email || 'U').trim().charAt(0).toUpperCase()}
            </button>
          ) : user === null ? (
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="text-xs font-black bg-[#ff9900] text-black px-4 py-2.5 rounded-full hover:bg-[#e68a00] transition-colors cursor-pointer whitespace-nowrap"
            >
              Sign In
            </button>
          ) : null}
          <Link
            href="/categories"
            className="md:hidden text-xs font-semibold bg-[#ff9900] text-black px-3.5 py-2.5 rounded-full hover:bg-[#e68a00] transition-colors"
          >
            Browse
          </Link>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-3 relative">
        <form onSubmit={handleSubmit} className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search videos..."
            className="w-full bg-[#1c1c1c] border border-[#2c2c2c] focus:border-[#ff9900] rounded-full pl-5 pr-12 py-2.5 text-sm text-white placeholder-neutral-500 outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#ff9900] text-black flex items-center justify-center cursor-pointer"
          >
            <IconSearch size={18} />
          </button>
        </form>

        {searchFocused && q.trim() && suggestions.length > 0 && (
          <div className="drop-in absolute left-4 right-4 top-13 z-50 bg-[#141414] border border-[#2a2a2a] rounded-2xl p-2 shadow-2xl space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 py-1 px-3 flex items-center gap-1.5">
              <IconSparkles size={12} className="text-[#ff9900]" />
              Suggestions
            </div>
            {suggestions.map((item, idx) => (
              <button
                key={item}
                type="button"
                onMouseEnter={() => setActiveSuggestion(idx)}
                onClick={() => goSearch(item)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left transition-colors font-medium cursor-pointer ${
                  activeSuggestion === idx
                    ? 'bg-[#ff9900] text-black font-bold'
                    : 'text-neutral-200 hover:bg-[#1f1f1f]'
                }`}
              >
                <IconSearch size={14} className={activeSuggestion === idx ? 'text-black' : 'text-neutral-500 shrink-0'} />
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Drawer Menu */}
      {open && (
        <nav className="lg:hidden border-t border-[#1f1f1f] px-4 py-2 fade-in">
          {user ? (
            <div className="px-2 py-3 border-b border-[#161616] mb-1">
              <p className="text-[15px] font-bold text-white truncate">{user.name || 'Member'}</p>
              <p className="text-xs text-neutral-500 truncate mt-0.5">{user.email}</p>
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await authSignOut();
                }}
                className="mt-2.5 min-h-[44px] px-4 rounded-xl text-sm font-bold text-red-400 bg-red-950/40 border border-red-900/50 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : user === null ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openAuthModal('signin');
              }}
              className="w-full min-h-[48px] my-2 rounded-2xl bg-[#ff9900] text-black text-sm font-black cursor-pointer"
            >
              Sign In / Register
            </button>
          ) : null}
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-2 py-3 text-neutral-200 hover:text-[#ff9900] border-b border-[#161616] last:border-0 transition-colors"
            >
              <n.icon size={18} />
              <span className="text-[15px] font-medium">{n.label}</span>
            </Link>
          ))}
        </nav>
      )}
      <AuthModal />
    </header>
  );
}
