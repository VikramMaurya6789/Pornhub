import { notFound } from 'next/navigation';
import { SEED_VIDEOS } from '../../../lib/seedData';
import scraper from '../../../lib/scraper.js';

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const vkey = (resolvedParams?.vkey || '').trim();

  if (!vkey || vkey.length < 5 || vkey.length > 50 || /[^a-zA-Z0-9_-]/.test(vkey)) {
    return {
      title: 'Video Not Found — OrangeHub',
      robots: { index: false, follow: false },
    };
  }

  let video = null;
  try {
    const seed = Array.isArray(SEED_VIDEOS) ? SEED_VIDEOS.find((v) => v.vkey === vkey) : null;
    if (seed) {
      video = seed;
    } else if (vkey) {
      await scraper.warmup();
      video = await scraper.videoInfo(vkey, false).catch(() => null);
    }
  } catch {}

  if (!video) {
    return {
      title: 'Video Not Found — OrangeHub',
      robots: { index: false, follow: false },
    };
  }

  const title = video.title || 'Watch Full HD Video';
  const authorText = video.author ? ` by ${video.author}` : '';
  const durText = video.duration && video.duration !== '0:00' ? ` (${video.duration})` : '';
  const description = `Watch "${video.title}"${durText}${authorText} in 1080p Full HD with zero ads on OrangeHub.`;

  let imageUrl = 'https://orangehub.royalcloud.qzz.io/og-banner.png';
  if (video.thumbnail) {
    imageUrl = video.thumbnail.startsWith('http')
      ? `https://orangehub.royalcloud.qzz.io/api/img?u=${encodeURIComponent(video.thumbnail)}`
      : (video.thumbnail.startsWith('/')
        ? `https://orangehub.royalcloud.qzz.io${video.thumbnail}`
        : `https://orangehub.royalcloud.qzz.io/${video.thumbnail}`);
  }

  const fullTitle = `${title} — OrangeHub`;

  return {
    title: fullTitle,
    description,
    openGraph: {
      title: fullTitle,
      description,
      url: `https://orangehub.royalcloud.qzz.io/watch/${vkey}`,
      siteName: 'OrangeHub',
      type: 'article',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
    },
  };
}

function toIsoDuration(durationStr) {
  if (!durationStr) return 'PT12M30S';
  const parts = String(durationStr).split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 'PT12M30S';
  let totalSec = 0;
  if (parts.length === 3) totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) totalSec = parts[0] * 60 + parts[1];
  else totalSec = parseInt(durationStr, 10) || 750;

  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `PT${h > 0 ? h + 'H' : ''}${m}M${s}S`;
}

export default async function WatchLayout({ children, params }) {
  const resolvedParams = await params;
  const vkey = (resolvedParams?.vkey || '').trim();

  if (!vkey || vkey.length < 5 || vkey.length > 50 || /[^a-zA-Z0-9_-]/.test(vkey)) {
    notFound();
  }

  let video = null;
  try {
    const seed = Array.isArray(SEED_VIDEOS) ? SEED_VIDEOS.find((v) => v.vkey === vkey) : null;
    if (seed) {
      video = seed;
    } else if (vkey) {
      await scraper.warmup();
      video = await scraper.videoInfo(vkey, false).catch(() => null);
    }
  } catch {}

  if (!video) {
    notFound();
  }

  const title = video.title || `Watch Full HD Video #${vkey}`;
  const description = video.title
    ? `Watch "${video.title}" in 1080p Full HD with zero ads on OrangeHub.`
    : 'Watch trending full length adult video in 1080p HD on OrangeHub.';

  let imageUrl = 'https://orangehub.royalcloud.qzz.io/og-banner.png';
  if (video.thumbnail) {
    imageUrl = video.thumbnail.startsWith('http')
      ? `https://orangehub.royalcloud.qzz.io/api/img?u=${encodeURIComponent(video.thumbnail)}`
      : (video.thumbnail.startsWith('/')
        ? `https://orangehub.royalcloud.qzz.io${video.thumbnail}`
        : `https://orangehub.royalcloud.qzz.io/${video.thumbnail}`);
  }

  let viewsCount = 50000;
  if (video.views) {
    const vs = String(video.views).toUpperCase();
    if (vs.endsWith('M')) viewsCount = Math.round(parseFloat(vs) * 1000000);
    else if (vs.endsWith('K')) viewsCount = Math.round(parseFloat(vs) * 1000);
    else viewsCount = parseInt(vs, 10) || 50000;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description: description,
    thumbnailUrl: [imageUrl],
    uploadDate: '2026-01-01T00:00:00.000Z',
    duration: toIsoDuration(video.duration),
    contentUrl: `https://orangehub.royalcloud.qzz.io/watch/${vkey}`,
    embedUrl: `https://orangehub.royalcloud.qzz.io/watch/${vkey}`,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'https://schema.org/WatchAction' },
      userInteractionCount: viewsCount
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
