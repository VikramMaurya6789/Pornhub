'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconSearch, IconHome, IconFlame, IconEye, IconStar, IconGrid,
  IconMenu, IconX, IconHeart, IconClock, IconTag, IconSparkles,
  IconShield, IconWifi
} from './Icons';

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
  const [dataSaver, setDataSaver] = useState(false);
  const headerRef = useRef(null);
  const router = useRouter();

  // Load recent searches and data saver state
  useEffect(() => {
    try {
      const stored = localStorage.getItem('oh_recent_searches');
      if (stored) setRecentSearches(JSON.parse(stored));
      setDataSaver(localStorage.getItem('oh_datasaver') === '1');
    } catch {}

    const onDataSaver = () => {
      try {
        setDataSaver(localStorage.getItem('oh_datasaver') === '1');
      } catch {}
    };
    window.addEventListener('oh_datasaver_changed', onDataSaver);
    return () => window.removeEventListener('oh_datasaver_changed', onDataSaver);
  }, []);

  const toggleDataSaver = () => {
    const next = !dataSaver;
    setDataSaver(next);
    try {
      localStorage.setItem('oh_datasaver', next ? '1' : '0');
      window.dispatchEvent(new CustomEvent('oh_datasaver_changed'));
    } catch {}
  };

  const handlePanic = () => {
    window.location.replace('https://www.google.com');
  };

  // Keyboard shortcut: Escape triggers Panic button if not in an input
  useEffect(() => {
    const handleKeyDownGlobal = (e) => {
      if (e.key === 'Escape') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        handlePanic();
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
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

          {/* Quick Header Actions: Data Saver & Panic */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <button
              type="button"
              onClick={toggleDataSaver}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                dataSaver
                  ? 'bg-[#152415] border-green-600/70 text-green-400'
                  : 'bg-[#1c1c1c] border-[#2c2c2c] text-neutral-400 hover:text-white'
              }`}
              title="Data saver mode (lower resolution, disable autoplay previews)"
            >
              <IconWifi size={14} className={dataSaver ? 'text-green-400' : 'text-neutral-500'} />
              <span className="hidden xl:inline">{dataSaver ? 'Data Saver: ON' : 'Data Saver'}</span>
            </button>

            <button
              type="button"
              onClick={handlePanic}
              className="px-2.5 py-1.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-400 hover:bg-red-900/60 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Panic button / Boss key (Esc) — Quick exit to Google"
            >
              <IconShield size={14} />
              <span>Panic</span>
            </button>
          </div>
        </div>

        <div className="lg:hidden ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handlePanic}
            className="px-2.5 py-2.5 rounded-full bg-red-950/60 border border-red-800/60 text-red-400 text-xs font-bold flex items-center gap-1"
            title="Panic button / Boss key (Esc)"
          >
            <IconShield size={13} />
            <span>Panic</span>
          </button>
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
    </header>
  );
}
