import { NextResponse } from 'next/server';

function getInitials(name) {
  if (!name || typeof name !== 'string') return 'OH';
  const clean = name.trim().replace(/[^\w\s-]/g, '');
  const words = clean.split(/[\s_-]+/).filter(Boolean);

  if (words.length === 0) return 'OH';
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const rawName = searchParams.get('name') || '';
  const initials = getInitials(rawName);

  const fontSize = initials.length > 2 ? 46 : (initials.length === 1 ? 68 : 56);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" fill="#ff9900"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#000000" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="1">${initials}</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
