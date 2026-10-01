'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { IconChevronL, IconChevronR } from './Icons';

export default function Pagination({ page, base, extra = '' }) {
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = start + 4;
  for (let p = start; p <= end; p++) pages.push(p);

  const href = (p) => `${base}${base.includes('?') ? '&' : '?'}page=${p}${extra}`;

  const btn = "min-w-10 h-10 px-3 rounded-lg flex items-center justify-center text-sm font-semibold transition-colors ";
  return (
    <div className="flex items-center justify-center gap-2 mt-10">
      {page > 1 && (
        <Link href={href(page - 1)} className={btn + "bg-[#1c1c1c] text-neutral-300 hover:bg-[#2a2a2a] hover:text-white"}>
          <IconChevronL size={18} />
        </Link>
      )}
      {pages.map(p => (
        <Link key={p} href={href(p)}
          className={btn + (p === page
            ? "bg-[#ff9900] text-black"
            : "bg-[#1c1c1c] text-neutral-300 hover:bg-[#2a2a2a] hover:text-white")}>
          {p}
        </Link>
      ))}
      <Link href={href(page + 1)} className={btn + "bg-[#1c1c1c] text-neutral-300 hover:bg-[#2a2a2a] hover:text-white"}>
        <IconChevronR size={18} />
      </Link>
    </div>
  );
}

export function SectionHeader({ title, href, icon: Icon }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="flex items-center gap-2.5 text-xl md:text-2xl font-bold text-white">
        {Icon && <span className="text-[#ff9900]"><Icon size={24} /></span>}
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-sm font-semibold text-[#ff9900] hover:text-[#ffb340] flex items-center gap-1 transition-colors">
          View all <IconChevronR size={16} />
        </Link>
      )}
    </div>
  );
}

export function PornstarAvatar({ avatar, fallbackAvatar, name, className = "w-full h-full object-cover" }) {
  const [src, setSrc] = useState(avatar || fallbackAvatar);
  useEffect(() => {
    setSrc(avatar || fallbackAvatar);
  }, [avatar, fallbackAvatar]);

  return (
    <img
      src={src || fallbackAvatar}
      alt={name}
      className={className}
      onError={(e) => {
        if (src !== fallbackAvatar) {
          setSrc(fallbackAvatar);
        } else {
          e.currentTarget.src = fallbackAvatar;
        }
      }}
    />
  );
}

