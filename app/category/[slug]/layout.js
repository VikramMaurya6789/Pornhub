import scraper from '../../../lib/scraper.js';

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const rawSlug = (resolvedParams?.slug || '').trim();
  const cleanSlug = rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const categoryTitle = cleanSlug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  let coverUrl = 'https://orangehub-195.netlify.app/og-banner.png';

  try {
    await scraper.warmup();
    const categories = await scraper.categories().catch(() => []);
    if (Array.isArray(categories)) {
      const match = categories.find((c) => {
        const cSlug = (c.slug || '').toLowerCase();
        const cName = (c.name || '').toLowerCase();
        return (
          cSlug.includes(cleanSlug) ||
          cSlug.replace(/[^a-z0-9]/g, '') === cleanSlug.replace(/[^a-z0-9]/g, '') ||
          cName === categoryTitle.toLowerCase()
        );
      });

      if (match && match.thumbnail) {
        coverUrl = match.thumbnail.startsWith('http')
          ? `https://orangehub-195.netlify.app/api/img?u=${encodeURIComponent(match.thumbnail)}`
          : (match.thumbnail.startsWith('/')
            ? `https://orangehub-195.netlify.app${match.thumbnail}`
            : `https://orangehub-195.netlify.app/${match.thumbnail}`);
      }
    }
  } catch {}

  const title = `${categoryTitle} Videos — Free Full HD | OrangeHub`;
  const description = `Watch the best ${categoryTitle} videos in 1080p Full HD on OrangeHub. 100% free streaming with zero ads and ultra-fast playback.`;
  const canonicalUrl = `https://orangehub-195.netlify.app/category/${cleanSlug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'OrangeHub',
      type: 'website',
      images: [
        {
          url: coverUrl,
          width: 1200,
          height: 630,
          alt: `${categoryTitle} Category Cover`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [coverUrl],
    },
  };
}

export default function CategoryLayout({ children }) {
  return children;
}
