import Link from 'next/link';
import { IconUser, IconStar, IconMessage } from '../../components/Icons';

export const metadata = {
  title: 'Community | OrangeHub',
  description: 'Join the OrangeHub community - top members, contests, and more.',
};

export default function CommunityPage() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 md:py-8">
      <div className="mb-8 text-center py-12 bg-gradient-to-br from-[#1b1b1b] to-[#0c0c0c] rounded-2xl border border-white/[0.06]">
        <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
          The OrangeHub Community
        </h1>
        <p className="text-neutral-400 max-w-xl mx-auto">
          Join thousands of members sharing videos, photos, and connecting with creators.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <Link
            href="/login"
            className="px-6 py-3 rounded-full bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold transition-colors"
          >
            Join Free
          </Link>
          <Link
            href="/models"
            className="px-6 py-3 rounded-full bg-[#1c1c1c] ring-1 ring-[#2c2c2c] text-white font-bold hover:bg-[#2a2a2a] transition-colors"
          >
            Browse Stars
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#141414] border border-[#222] rounded-2xl p-6">
          <div className="w-12 h-12 rounded-xl bg-[#ff9900]/15 flex items-center justify-center mb-4">
            <IconUser size={24} className="text-[#ff9900]" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Top Members</h2>
          <p className="text-sm text-neutral-400">Discover the most active community members and content creators.</p>
        </div>
        <div className="bg-[#141414] border border-[#222] rounded-2xl p-6">
          <div className="w-12 h-12 rounded-xl bg-[#ff9900]/15 flex items-center justify-center mb-4">
            <IconStar size={24} className="text-[#ff9900]" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Contests</h2>
          <p className="text-sm text-neutral-400">Participate in monthly contests and win prizes.</p>
        </div>
        <div className="bg-[#141414] border border-[#222] rounded-2xl p-6">
          <div className="w-12 h-12 rounded-xl bg-[#ff9900]/15 flex items-center justify-center mb-4">
            <IconMessage size={24} className="text-[#ff9900]" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Discussions</h2>
          <p className="text-sm text-neutral-400">Join conversations with fellow members.</p>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#222] rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Community Features Coming Soon</h2>
        <p className="text-neutral-400 text-sm">We're building member profiles, forums, and more. Stay tuned!</p>
      </div>
    </div>
  );
}
