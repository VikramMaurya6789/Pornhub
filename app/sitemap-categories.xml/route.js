import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SITEMAP_CATEGORIES = [
  'amateur',
  'verified-amateurs',
  'solo-female',
  'big-dick',
  'masturbation',
  'pov',
  'anal',
  'milf',
  'japanese',
  'small-tits',
  '60fps',
  'blowjob',
  'teen',
  'toys',
  'creampie',
  'asian',
  'reality',
  'bbw',
  'tattooed-women',
  'threesome',
  'ebony',
  'vr',
  'indian',
  'bhabhi',
  'desi',
  'hardcore',
  'rough',
  'squirt',
  'compilation',
  'public',
  'cartoon',
  'hentai',
  'massage',
  'cosplay',
  'female-orgasm',
  'gangbang',
  'romantic',
  'vintage',
  'fetish',
  'latina',
  'russian',
  'german',
  'french',
  'british',
  'italian',
  'korean',
  'interracial',
  'striptease',
  'babe',
  'blonde',
  'brunette',
  'redhead',
  'big-ass',
  'big-tits',
  'college',
  'mature',
  'webcam',
];

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://orangehub-195.netlify.app';
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Categories hub page
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/categories</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>0.9</priority>\n`;
  xml += `  </url>\n`;

  for (const slug of SITEMAP_CATEGORIES) {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/category/${escapeXml(slug)}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
