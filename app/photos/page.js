import Link from 'next/link';
import { IconShare } from '../../components/Icons';

export const metadata = {
  title: 'Photos & GIFs | OrangeHub',
  description: 'Browse photo albums and GIFs on OrangeHub.',
};

export default function PhotosPage() {
  // Placeholder - in production this would fetch from an API
  const albums = [];

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 md:py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          <IconShare size={28} className="text-[#ff9900]" />
          Photos & GIFs
        </h1>
        <p className="text-neutral-400 text-sm mt-2">Browse photo albums and animated GIFs from our community.</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['All', 'Solo Female', 'Straight', 'Solo Male', 'Gay', 'Transgender'].map((seg) => (
          <button
            key={seg}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
              seg === 'All'
                ? 'bg-[#ff9900] text-black'
                : 'bg-[#1c1c1c] text-neutral-300 hover:bg-[#2a2a2a]'
            }`}
          >
            {seg}
          </button>
        ))}
      </div>

      {albums.length === 0 ? (
        <div className="text-center py-16 bg-[#141414] rounded-2xl border border-[#222]">
          <p className="text-neutral-400 mb-4">Photo albums are coming soon!</p>
          <p className="text-sm text-neutral-500">Check back later for community photo content.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {albums.map((album) => (
            <Link key={album.id} href={`/photos/${album.id}`} className="group">
              <div className="aspect-square rounded-xl overflow-hidden bg-[#141414]">
                <img src={album.thumbnail} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </div>
              <h3 className="mt-2 text-sm font-medium text-neutral-200 group-hover:text-[#ff9900]">{album.title}</h3>
              <p className="text-xs text-neutral-500">{album.photoCount} photos</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
