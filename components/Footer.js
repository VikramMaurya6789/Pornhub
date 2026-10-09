'use client';
import Link from 'next/link';
import { openCookiePreferences } from '../lib/consent';

export default function Footer() {
  return (
    <footer className="border-t border-[#1f1f1f] mt-16 bg-[#0a0a0a]">
      <div className="max-w-[1600px] mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center mb-3">
              <span className="font-black text-2xl text-white">Orange</span>
              <span className="font-black text-2xl text-black bg-[#ff9900] rounded-md px-2 py-0.5 ml-1">hub</span>
            </div>
            <p className="text-sm text-neutral-400 max-w-md leading-relaxed">
              OrangeHub is a modern video indexer. All content is hosted by third parties.
            </p>
            <p className="text-xs text-neutral-500 mt-2 font-medium">
              18+ only. All models were 18 years or older at the time of depiction.
            </p>
          </div>

          <div className="flex flex-wrap gap-10 text-sm">
            <div className="flex flex-col gap-2.5">
              <span className="font-bold text-white mb-1">Discover</span>
              <Link href="/list/hottest" className="text-neutral-400 hover:text-[#ff9900] transition-colors">Hottest</Link>
              <Link href="/list/most_viewed" className="text-neutral-400 hover:text-[#ff9900] transition-colors">Most Viewed</Link>
              <Link href="/list/top_rated" className="text-neutral-400 hover:text-[#ff9900] transition-colors">Top Rated</Link>
              <Link href="/list/newest" className="text-neutral-400 hover:text-[#ff9900] transition-colors">Newest</Link>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="font-bold text-white mb-1">Navigation</span>
              <Link href="/categories" className="text-neutral-400 hover:text-[#ff9900] transition-colors">Categories</Link>
              <Link href="/playlists" className="text-neutral-400 hover:text-[#ff9900] transition-colors">Playlists</Link>
              <Link href="/favorites" className="text-neutral-400 hover:text-[#ff9900] transition-colors">Favorites</Link>
              <Link href="/" className="text-neutral-400 hover:text-[#ff9900] transition-colors">Home</Link>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="font-bold text-white mb-1">Legal &amp; Policy</span>
              <Link href="/dmca" className="text-neutral-400 hover:text-[#ff9900] transition-colors font-medium">DMCA Takedown</Link>
              <Link href="/2257" className="text-neutral-400 hover:text-[#ff9900] transition-colors font-medium">2257 Statement</Link>
              <Link href="/privacy" className="text-neutral-400 hover:text-[#ff9900] transition-colors font-medium">Privacy Policy</Link>
              <Link href="/terms" className="text-neutral-400 hover:text-[#ff9900] transition-colors font-medium">Terms of Use</Link>
              <button
                type="button"
                onClick={openCookiePreferences}
                className="text-left text-neutral-400 hover:text-[#ff9900] transition-colors font-medium cursor-pointer"
              >
                Cookie Settings
              </button>
              <a href="/rss.xml" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-[#ff9900] transition-colors font-medium">RSS Feed</a>
            </div>
          </div>
        </div>

        <div className="border-t border-[#181818] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-4">
          <p>&copy; {new Date().getFullYear()} OrangeHub. All rights reserved.</p>
          <p className="text-center sm:text-right">
            All content is hosted by third parties.
          </p>
        </div>
      </div>
    </footer>
  );
}
