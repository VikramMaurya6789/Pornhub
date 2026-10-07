'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconGrid } from '../../components/Icons';
import { formatCount } from '../../lib/format';
import BackToTop from '../../components/BackToTop';

export default function CategoriesPage() {
  const [cats, setCats] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/categories', { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'failed');
        setCats(j);
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      <h1 className="fade-in flex items-center gap-2.5 text-xl md:text-2xl font-extrabold text-white tracking-tight mb-6">
        <span className="w-9 h-9 rounded-xl bg-[#ff9900]/10 border border-[#ff9900]/20 flex items-center justify-center text-[#ff9900]">
          <IconGrid size={18} />
        </span>
        Categories
      </h1>
      {err && <p className="text-red-400 text-sm">Failed to load: {err}</p>}
      {!cats && !err ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => <div key={i} className="aspect-[2/1] rounded-xl skeleton" />)}
        </div>
      ) : cats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {cats.map((c, i) => (
            <Link key={c.slug} href={`/category?slug=${encodeURIComponent(c.slug)}`}
              className="card-in group relative rounded-xl overflow-hidden aspect-[2/1] bg-[#141414] ring-1 ring-white/5 hover:ring-[#ff9900]/60 transition-all duration-300 hover:shadow-[0_8px_30px_-6px_rgba(255,153,0,0.35)]"
              style={{ animationDelay: `${Math.min(i, 30) * 25}ms` }}>
              {c.thumbnail && (
                <img src={c.thumbnail} alt="" loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.07]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3.5">
                <p className="font-bold text-white text-[15px] group-hover:text-[#ff9900] transition-colors">{c.name}</p>
                {c.count && <p className="text-[11px] text-neutral-400">{formatCount(c.count)}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <BackToTop />
    </div>
  );
}
