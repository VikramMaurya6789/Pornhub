import { NextResponse } from 'next/server';
import { getAllVideos } from '../../lib/sitemapHelper.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://orangehub.royalcloud.qzz.io';
  const now = new Date().toISOString();

  const all = getAllVideos();
  const total = all.length;
  const pageSize = 1000;
  const pagesCount = Math.max(1, Math.min(50, Math.ceil(total / pageSize)));

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // First video sitemap
  xml += `  <sitemap>\n`;
  xml += `    <loc>${baseUrl}/sitemap-videos.xml</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  // Creators sitemap
  xml += `  <sitemap>\n`;
  xml += `    <loc>${baseUrl}/sitemap-creators.xml</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  // Categories sitemap
  xml += `  <sitemap>\n`;
  xml += `    <loc>${baseUrl}/sitemap-categories.xml</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  // Paginated video sitemaps (/sitemap-videos-2.xml etc.)
  for (let p = 2; p <= Math.min(pagesCount, 10); p++) {
    xml += `  <sitemap>\n`;
    xml += `    <loc>${baseUrl}/sitemap-videos-${p}.xml</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `  </sitemap>\n`;
  }

  xml += `</sitemapindex>\n`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
