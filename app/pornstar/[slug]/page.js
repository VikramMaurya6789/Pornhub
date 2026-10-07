import Link from 'next/link';
import VideoCard from '../../../components/VideoCard';
import Pagination, { PornstarAvatar } from '../../../components/UI';
import { IconStar, IconFlame, IconChevronL } from '../../../components/Icons';
import FollowPornstarButton from '../../../components/FollowPornstarButton';
import scraper from '../../../lib/scraper.js';
import { TOP_100_MODELS } from '../../../lib/leaderboardData.js';

const proxied = (v) => (v ? `/api/img?u=${encodeURIComponent(v)}` : null);

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const rawSlug = resolvedParams?.slug || '';
  const slug = String(rawSlug).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const name = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  let avatarUrl = `https://orangehub.royalcloud.qzz.io/api/avatar?name=${encodeURIComponent(name)}`;
  try {
    await scraper.warmup();
    const data = await scraper.pornstarVideos(slug, 1).catch(() => null);
    if (data?.avatar) {
      avatarUrl = data.avatar.startsWith('http')
        ? `https://orangehub.royalcloud.qzz.io/api/img?u=${encodeURIComponent(data.avatar)}`
        : `https://orangehub.royalcloud.qzz.io${data.avatar.startsWith('/') ? '' : '/'}${data.avatar}`;
    }
  } catch {}

  const title = `${name} — Free Full HD Videos & Scenes | OrangeHub`;
  const description = `Watch full 1080p HD videos starring ${name} on OrangeHub. Stream all exclusive scenes and latest releases in high definition with zero ads.`;
  const canonicalUrl = `https://orangehub.royalcloud.qzz.io/pornstar/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'OrangeHub',
      type: 'profile',
      images: [
        {
          url: avatarUrl,
          width: 500,
          height: 500,
          alt: `${name} Profile Avatar`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [avatarUrl],
    },
  };
}

export default async function PornstarPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const rawSlug = resolvedParams?.slug || '';
  const slug = String(rawSlug).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const page = Math.max(1, parseInt(resolvedSearchParams?.page || '1', 10));

  await scraper.warmup();
  let data = null;
  let err = null;

  try {
    data = await scraper.pornstarVideos(slug, page);
  } catch (e) {
    err = e.message;
  }

  const name = data?.name || slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const fallbackAvatar = `/api/avatar?name=${encodeURIComponent(name)}`;
  const realAvatar = data?.avatar && /phncdn\.com/i.test(data.avatar) ? proxied(data.avatar) : data?.avatar;
  const avatar = realAvatar || fallbackAvatar;

  const rawVideos = data?.videos || [];
  const videos = rawVideos.map((v) => ({
    ...v,
    thumbnail: proxied(v.thumbnail) || '/og-image.jpg',
    preview: v.preview && /^https?:\/\//i.test(v.preview) ? `/api/seg?u=${encodeURIComponent(v.preview)}` : v.preview,
  }));

  const currentIndex = TOP_100_MODELS.findIndex((m) => m.slug === slug);
  let relatedModels = [];
  if (currentIndex !== -1) {
    const start = Math.max(0, Math.min(currentIndex - 3, TOP_100_MODELS.length - 8));
    relatedModels = TOP_100_MODELS.slice(start, start + 9).filter((m) => m.slug !== slug).slice(0, 8);
  } else {
    relatedModels = TOP_100_MODELS.slice(0, 8);
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 md:py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs md:text-sm text-neutral-400">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span>/</span>
        <Link href="/models" className="hover:text-white transition-colors">Pornstars</Link>
        <span>/</span>
        <span className="text-[#ff9900] font-medium">{name}</span>
      </div>

      {/* Profile Header */}
      <div className="mb-8 p-6 md:p-8 rounded-2xl bg-gradient-to-br from-[#1b1b1b] via-[#131313] to-[#0c0c0c] border border-white/[0.06] shadow-2xl flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="relative shrink-0">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden ring-[3px] ring-[#ff9900] ring-offset-4 ring-offset-[#0a0a0a] bg-[#222] shadow-[0_0_40px_rgba(255,153,0,0.25)] flex items-center justify-center">
            <PornstarAvatar
              avatar={avatar}
              fallbackAvatar={fallbackAvatar}
              name={name}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#ff9900] text-black p-1.5 rounded-full shadow-lg">
            <IconStar size={14} className="fill-black" />
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              {name}
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#ff9900] text-black shadow-md">
              Verified
            </span>
            <FollowPornstarButton slug={slug} name={name} avatar={avatar} />
          </div>
          <p className="mt-2.5 text-sm text-neutral-400 max-w-2xl leading-relaxed">
            Watch full 1080p HD videos starring {name}. Stream all exclusive scenes and latest releases in high definition with zero ads.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs font-semibold text-neutral-300">
            <div className="flex items-center gap-1.5 bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
              <IconFlame size={14} className="text-[#ff9900]" />
              <span>{videos.length ? `${videos.length}+ Videos on page` : 'Full HD Collection'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
              <span className="text-[#ff9900]">Page {page}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fans Also Watched */}
      {relatedModels.length > 0 && (
        <section className="mb-10 p-5 rounded-2xl bg-[#141414] border border-[#222]">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <IconStar size={18} className="text-[#ff9900]" />
            <span>Fans Also Watched</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
            {relatedModels.map((rel) => {
              const relFallback = `/api/avatar?name=${encodeURIComponent(rel.name)}`;
              return (
                <Link
                  key={rel.slug}
                  href={`/pornstar/${rel.slug}`}
                  className="group flex flex-col items-center text-center p-2.5 rounded-xl hover:bg-white/5 transition-all"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-[#ff9900] bg-[#222] transition-all mb-2 flex items-center justify-center">
                    <PornstarAvatar
                      avatar={rel.avatar || relFallback}
                      fallbackAvatar={relFallback}
                      name={rel.name}
                    />
                  </div>
                  <span className="text-xs font-semibold text-neutral-200 group-hover:text-[#ff9900] line-clamp-1 transition-colors">
                    {rel.name}
                  </span>
                  <span className="text-[10px] text-neutral-500 mt-0.5">
                    {rel.subs ? `${rel.subs} fans` : 'Verified'}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Videos Section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          <IconFlame size={18} className="text-[#ff9900]" />
          Videos starring {name}
        </h2>
      </div>

      {err ? (
        <div className="p-8 text-center bg-[#141414] rounded-xl border border-red-500/20 text-neutral-300">
          <p className="text-red-400 font-semibold mb-2">Could not load videos for {name}</p>
          <p className="text-sm text-neutral-500 mb-4">{err}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff9900] text-black font-bold text-sm"
          >
            <IconChevronL size={16} /> Return to Home
          </Link>
        </div>
      ) : videos.length === 0 ? (
        <div className="p-12 text-center bg-[#141414] rounded-xl border border-[#222]">
          <p className="text-neutral-400 text-base mb-4">No videos found for this pornstar.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff9900] text-black font-bold text-sm"
          >
            <IconChevronL size={16} /> Return to Home
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-7">
            {videos.map((v, i) => (
              <VideoCard key={v.vkey || i} v={v} index={i} />
            ))}
          </div>

          <Pagination page={page} base={`/pornstar/${slug}`} />
        </>
      )}
    </div>
  );
}
