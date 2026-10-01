'use client';
import { useState } from 'react';
import { IconFlame, IconStar, IconClock, IconRefresh } from './Icons';

export default function ListingFilterBar({
  duration = 'all',
  onDurationChange,
  hdOnly = false,
  onHdOnlyChange,
  sort = 'newest',
  onSortChange,
  totalCount,
}) {
  const [openDropdown, setOpenDropdown] = useState(false);

  const DURATION_OPTIONS = [
    { id: 'all', label: 'All Full Length (10+ min)' },
    { id: '10-20', label: '10 - 20 min' },
    { id: '20-40', label: '20 - 40 min' },
    { id: '40+', label: '40+ min Long' },
  ];

  const SORT_OPTIONS = [
    { id: 'newest', label: 'Newest', icon: IconRefresh },
    { id: 'viewed', label: 'Most Viewed', icon: IconFlame },
    { id: 'rated', label: 'Top Rated', icon: IconStar },
    { id: 'longest', label: 'Longest', icon: IconClock },
  ];

  const hasActiveFilters = duration !== 'all' || hdOnly;

  return (
    <div className="bg-[#121212] border border-[#222] rounded-2xl p-3 sm:p-4 mb-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Duration & HD Toggle */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 mr-1">
            <IconClock size={15} className="text-[#ff9900]" />
            <span>Duration:</span>
          </div>

          <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-xl border border-white/5">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onDurationChange && onDurationChange(opt.id)}
                className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  duration === opt.id
                    ? 'bg-[#ff9900] text-black font-bold shadow-sm'
                    : 'text-neutral-300 hover:text-white hover:bg-[#252525]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* HD Only Toggle */}
          <button
            type="button"
            onClick={() => onHdOnlyChange && onHdOnlyChange(!hdOnly)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              hdOnly
                ? 'bg-[#ff9900]/20 border-[#ff9900] text-[#ff9900]'
                : 'bg-[#1a1a1a] border-[#2c2c2c] text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${hdOnly ? 'bg-[#ff9900]' : 'bg-neutral-600'}`} />
            <span>HD Only</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                if (onDurationChange) onDurationChange('all');
                if (onHdOnlyChange) onHdOnlyChange(false);
              }}
              className="text-xs text-neutral-500 hover:text-[#ff9900] underline ml-1 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {/* Right: Sort & Total text */}
        <div className="flex items-center gap-3">
          {typeof totalCount === 'number' && (
            <span className="text-xs text-neutral-400 hidden md:inline">
              {totalCount} videos
            </span>
          )}

          <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-xl border border-white/5">
            {SORT_OPTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSortChange && onSortChange(s.id)}
                  className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    sort === s.id
                      ? 'bg-[#ff9900] text-black font-bold shadow-sm'
                      : 'text-neutral-300 hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  <Icon size={13} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
