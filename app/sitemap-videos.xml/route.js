import { NextResponse } from 'next/server';
import { generateVideoSitemapXml } from '../../lib/sitemapHelper.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const xml = generateVideoSitemapXml(1, 1000);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
