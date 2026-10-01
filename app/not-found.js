import Link from 'next/link';
import { IconFlame, IconSearch, IconAlert } from '../components/Icons';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#ff9900]/10 border border-[#ff9900]/30 flex items-center justify-center text-[#ff9900] mb-6 shadow-2xl shadow-[#ff9900]/10">
        <IconAlert size={38} className="text-[#ff9900]" />
      </div>
      <h1 className="text-2xl md:text-3xl font-black text-white mb-2">
        Video or Content Not Found
      </h1>
      <p className="text-xs sm:text-sm text-neutral-400 max-w-md mb-8 leading-relaxed">
        The video or page you are looking for has been removed, has expired, or does not exist. Use the search bar below or explore the hottest full HD videos.
      </p>

      {/* Search Bar Form */}
      <form action="/search" method="GET" className="w-full max-w-md mb-8 flex items-center relative">
        <input
          type="text"
          name="q"
          placeholder="Search millions of full HD videos..."
          className="w-full bg-[#141414] border border-[#2a2a2a] focus:border-[#ff9900] rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder-neutral-500 outline-none transition-colors"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-1.5 p-2 rounded-lg bg-[#ff9900] hover:bg-[#e68a00] text-black transition-colors cursor-pointer"
        >
          <IconSearch size={18} />
        </button>
      </form>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold text-sm transition-colors shadow-lg shadow-[#ff9900]/20"
        >
          Return Home
        </Link>
        <Link
          href="/list/hottest"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#282828] text-neutral-200 hover:text-white border border-[#2a2a2a] font-semibold text-sm transition-colors"
        >
          <IconFlame size={16} className="text-[#ff9900]" />
          <span>Browse Hottest</span>
        </Link>
      </div>
    </div>
  );
}
