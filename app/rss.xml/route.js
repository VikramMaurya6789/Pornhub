import scraper from '../../lib/scraper.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://orangehub-195.netlify.app';
  let videos = [];
  try {
    const feed = await scraper.feed('newest', 1);
    videos = feed?.videos || [];
  } catch {
    const fallback = scraper.getFallbackVideos ? scraper.getFallbackVideos() : [];
    videos = fallback.slice(0, 30);
  }

  if (videos.length === 0) {
    const fallback = scraper.getFallbackVideos ? scraper.getFallbackVideos() : [];
    videos = fallback.slice(0, 30);
  }

  const items = videos.slice(0, 30).map((v) => {
    const title = (v.title || 'Video')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    const link = `${baseUrl}/watch/${v.vkey}`;
    const pubDate = new Date().toUTCString();
    const thumbUrl = (v.thumbnail || '').replace(/&/g, '&amp;');
    const enclosure = thumbUrl ? `<enclosure url="${thumbUrl}" type="image/jpeg" length="0" />` : '';

    return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description><![CDATA[Watch ${v.title} on OrangeHub. Duration: ${v.duration || '--:--'}]]></description>
      <pubDate>${pubDate}</pubDate>
      ${enclosure}
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>OrangeHub - Latest Videos</title>
    <link>${baseUrl}</link>
    <description>Latest high definition adult streaming videos on OrangeHub</description>
    <language>en-us</language>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
}
