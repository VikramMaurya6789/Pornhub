import { NextResponse } from 'next/server';
import { TOP_100_MODELS } from '../../lib/leaderboardData.js';

export const dynamic = 'force-dynamic';

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(req) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://orangehub-195.netlify.app';
  const now = new Date().toISOString();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = 1000;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const creators = TOP_100_MODELS.slice(start, end);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const m of creators) {
    if (!m?.slug) continue;
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/pornstar/${escapeXml(m.slug)}</loc>\n`;
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
