'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  IconStar, IconBadgeCheck, IconSearch, IconCheck, IconBell, IconEye,
  IconFlame, IconList, IconGrid
} from '../../components/Icons';
import { TOP_100_MODELS } from '../../lib/leaderboardData';

export default function ModelsPage() {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [followedStars, setFollowedStars] = useState({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('oh_subscriptions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const map = {};
          parsed.forEach((s) => {
            if (s && s.name) map[s.name] = true;
          });
          setFollowedStars(map);
          return;
        }
      }
      // Fallback check individual keys
      const map = {};
      TOP_100_MODELS.forEach((m) => {
        if (localStorage.getItem(`oh_sub_${m.name}`) === '1') {
          map[m.name] = true;
        }
      });
      setFollowedStars(map);
    } catch {}
  }, []);

  const toggleFollow = (e, model) => {
    e.preventDefault();
    e.stopPropagation();
    const isNowFollowed = !followedStars[model.name];

    setFollowedStars((prev) => ({
      ...prev,
      [model.name]: isNowFollowed,
    }));

    try {
      const stored = localStorage.getItem('oh_subscriptions');
      let subs = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(subs)) subs = [];

      if (isNowFollowed) {
        if (!subs.some((s) => s.name === model.name)) {
          subs.push({
            name: model.name,
            slug: model.slug,
            avatar: model.avatar,
            tag: model.tag,
            followedAt: new Date().toISOString(),
          });
        }
        localStorage.setItem(`oh_sub_${model.name}`, '1');
      } else {
        subs = subs.filter((s) => s.name !== model.name);
        localStorage.removeItem(`oh_sub_${model.name}`);
      }

      localStorage.setItem('oh_subscriptions', JSON.stringify(subs));
      window.dispatchEvent(new Event('oh_sub_changed'));
    } catch {}
  };

  const filtered = useMemo(() => {
    let list = TOP_100_MODELS;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.tag.toLowerCase().includes(q)
      );
    }
    return list;
  }, [query]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      {/* Header & Leaderboard Intro */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#1f1f1f] mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full bg-[#ff9900]/15 text-[#ff9900] text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 border border-[#ff9900]/30">
              <IconFlame size={14} /> Official Leaderboard
            </span>
            <span className="text-xs text-neutral-400 font-medium">Top 100 Verified Stars</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white flex items-center gap-3">
            Top 100 Pornstars & Creators
          </h1>
          <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
            Ranked continuously by internal community views and follower activity. Follow your favorites to personalize your feed.
          </p>
        </div>

        {/* Filters and View Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-xl bg-[#141414] p-1 border border-[#2a2a2a]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#222] text-[#ff9900]' : 'text-neutral-400 hover:text-white'
              }`}
              title="Grid View"
              aria-label="Grid View"
            >
              <IconGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-[#222] text-[#ff9900]' : 'text-neutral-400 hover:text-white'
              }`}
              title="Table View"
              aria-label="Table View"
            >
              <IconList size={18} />
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative min-w-[220px]">
            <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search star or studio..."
              className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9900] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Podium Highlight (Top 3) if no search filter */}
      {!query && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {filtered.slice(0, 3).map((star, idx) => {
            const isSub = !!followedStars[star.name];
            const rank = idx + 1;
            const rankStyles =
              rank === 1
                ? 'from-[#ffd700]/15 via-[#1a1708] to-[#121212] border-amber-500/50 shadow-amber-500/10'
                : rank === 2
                ? 'from-slate-400/15 via-[#141414] to-[#121212] border-slate-400/40 shadow-slate-400/10'
                : 'from-amber-700/15 via-[#141414] to-[#121212] border-amber-700/40 shadow-amber-700/10';

            const badgeBg =
              rank === 1
                ? 'bg-amber-400 text-black'
                : rank === 2
                ? 'bg-slate-300 text-black'
                : 'bg-amber-700 text-white';

            const views = star.viewsAllTime || star.viewsMonth || star.viewsWeek;

            return (
              <Link
                key={star.name}
                href={`/pornstar/${star.slug}`}
                className={`relative flex flex-col items-center p-6 rounded-3xl bg-gradient-to-b border ${rankStyles} shadow-2xl transition-transform hover:-translate-y-1`}
              >
                {/* Rank Badge */}
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-black shadow-md ${badgeBg}`}>
                  #{rank} {rank === 1 ? 'CHAMPION' : rank === 2 ? 'RUNNER UP' : 'TOP 3'}
                </div>

                {/* Avatar with glowing ring */}
                <div className="relative mt-4 mb-4">
                  <div className={`w-28 h-28 rounded-full overflow-hidden p-1 bg-gradient-to-tr ${
                    rank === 1 ? 'from-amber-400 to-yellow-200' : rank === 2 ? 'from-slate-300 to-white' : 'from-amber-600 to-amber-400'
                  }`}>
                    <img
                      src={star.avatar}
                      alt={star.name}
                      className="w-full h-full object-cover rounded-full bg-[#1a1a1a]"
                      onError={(e) => {
                        e.currentTarget.src = `/api/avatar?name=${encodeURIComponent(star.name)}`;
                      }}
                    />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#ff9900] text-black flex items-center justify-center shadow-lg">
                    <IconBadgeCheck size={16} className="stroke-[3]" />
                  </span>
                </div>

                <h3 className="font-black text-lg text-white group-hover:text-[#ff9900] transition-colors">
                  {star.name}
                </h3>
                <span className="text-xs font-bold text-[#ff9900] mt-0.5">{star.tag}</span>

                {/* Performance stats */}
                <div className="grid grid-cols-3 gap-2 w-full mt-4 pt-4 border-t border-white/10 text-center">
                  <div>
                    <p className="text-xs font-black text-white">{views}</p>
                    <p className="text-[10px] text-neutral-400">Views</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{star.subs}</p>
                    <p className="text-[10px] text-neutral-400">Followers</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{star.videos}</p>
                    <p className="text-[10px] text-neutral-400">Full Videos</p>
                  </div>
                </div>

                {/* Follow Button */}
                <button
                  onClick={(e) => toggleFollow(e, star)}
                  className={`w-full mt-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSub
                      ? 'bg-[#1e1e1e] text-neutral-300 border border-[#333] hover:text-white'
                      : 'bg-[#ff9900] text-black hover:bg-[#e68a00] shadow-lg shadow-[#ff9900]/20'
                  }`}
                >
                  {isSub ? (
                    <>
                      <IconCheck size={14} className="text-[#ff9900] stroke-[3]" /> Following
                    </>
                  ) : (
                    <>
                      <IconBell size={14} /> Follow Star
                    </>
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      )}

      {/* Leaderboard Table View */}
      {viewMode === 'table' ? (
        <div className="bg-[#141414] border border-[#222] rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#222] bg-[#181818] text-neutral-400 uppercase text-[11px] font-bold">
                  <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                  <th className="py-3.5 px-4">Performer</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Category</th>
                  <th className="py-3.5 px-4 text-right">
                    Total Views
                  </th>
                  <th className="py-3.5 px-4 text-right hidden sm:table-cell">Followers</th>
                  <th className="py-3.5 px-4 text-right hidden sm:table-cell">Videos</th>
                  <th className="py-3.5 px-4 text-center w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {filtered.map((star) => {
                  const isSub = !!followedStars[star.name];
                  const views = star.viewsAllTime || star.viewsMonth || star.viewsWeek;

                  return (
                    <tr
                      key={star.name}
                      className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4 text-center font-black">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            star.rank === 1
                              ? 'bg-amber-400 text-black'
                              : star.rank === 2
                              ? 'bg-slate-300 text-black'
                              : star.rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'text-neutral-400 bg-[#1c1c1c]'
                          }`}
                        >
                          #{star.rank}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <Link
                          href={`/pornstar/${star.slug}`}
                          className="flex items-center gap-3 group-hover:text-[#ff9900] transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#222] ring-1 ring-white/10 shrink-0">
                            <img
                              src={star.avatar}
                              alt={star.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = `/api/avatar?name=${encodeURIComponent(star.name)}`;
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover:text-[#ff9900] flex items-center gap-1.5 truncate">
                              <span>{star.name}</span>
                              <IconBadgeCheck size={14} className="text-[#ff9900] shrink-0" />
                            </div>
                            <span className="text-[11px] text-neutral-400 md:hidden">{star.tag}</span>
                          </div>
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded-full bg-[#222] text-[#ff9900] text-[11px] font-semibold border border-white/5">
                          {star.tag}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {views}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-neutral-300 hidden sm:table-cell">
                        {star.subs}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-neutral-400 hidden sm:table-cell">
                        {star.videos}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => toggleFollow(e, star)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSub
                              ? 'bg-[#222] text-neutral-300 border border-[#333] hover:text-white'
                              : 'bg-[#ff9900] text-black hover:bg-[#e68a00]'
                          }`}
                        >
                          {isSub ? 'Following' : 'Follow'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Leaderboard Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {filtered.map((star, idx) => {
            const isSub = !!followedStars[star.name];
            const views = star.viewsAllTime || star.viewsMonth || star.viewsWeek;

            return (
              <Link
                key={star.name}
                href={`/pornstar/${star.slug}`}
                className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-[#141414] to-[#0c0c0c] border border-white/5 hover:border-[#ff9900]/50 transition-all shadow-xl hover:-translate-y-1"
                style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}
              >
                {/* Rank Badge */}
                <span
                  className={`absolute top-3 left-3 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shadow-md ${
                    star.rank === 1
                      ? 'bg-amber-400 text-black font-black'
                      : star.rank === 2
                      ? 'bg-slate-300 text-black font-black'
                      : star.rank === 3
                      ? 'bg-amber-700 text-white font-black'
                      : 'bg-[#1c1c1c] border border-[#333] text-neutral-300'
                  }`}
                >
                  #{star.rank}
                </span>

                {/* Avatar with Ring */}
                <div className="relative mt-2 mb-3">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-3 ring-[#ff9900]/30 group-hover:ring-[#ff9900] transition-all bg-[#1a1a1a] shadow-xl">
                    <img
                      src={star.avatar}
                      alt={star.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.src = `/api/avatar?name=${encodeURIComponent(star.name)}`;
                      }}
                    />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#ff9900] text-black flex items-center justify-center shadow-md">
                    <IconBadgeCheck size={14} className="stroke-[3]" />
                  </span>
                </div>

                {/* Name & Tag */}
                <h3 className="font-bold text-sm text-white group-hover:text-[#ff9900] transition-colors truncate max-w-full">
                  {star.name}
                </h3>
                <span className="text-[11px] font-semibold text-neutral-400 mt-0.5 truncate max-w-full">
                  {star.tag}
                </span>

                {/* Stats */}
                <div className="flex items-center justify-center gap-3 text-xs text-neutral-400 mt-3 pt-3 border-t border-[#1c1c1c] w-full">
                  <div>
                    <p className="font-bold text-white text-[12px]">{views}</p>
                    <p className="text-[10px] text-neutral-500">Views</p>
                  </div>
                  <div className="w-px h-6 bg-[#222]" />
                  <div>
                    <p className="font-bold text-white text-[12px]">{star.subs}</p>
                    <p className="text-[10px] text-neutral-500">Subs</p>
                  </div>
                </div>

                {/* Follow Button */}
                <div className="mt-4 w-full">
                  <button
                    onClick={(e) => toggleFollow(e, star)}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSub
                        ? 'bg-[#1c1c1c] text-neutral-300 border border-[#333] hover:text-white'
                        : 'bg-[#ff9900] text-black hover:bg-[#e68a00]'
                    }`}
                  >
                    {isSub ? (
                      <>
                        <IconCheck size={14} className="text-[#ff9900] stroke-[3]" /> Following
                      </>
                    ) : (
                      <>
                        <IconBell size={14} /> Follow
                      </>
                    )}
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
