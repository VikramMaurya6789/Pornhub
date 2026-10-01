import { NextResponse } from 'next/server';
import prisma from '../../../../lib/db.js';

// GET /api/cron/cleanup
export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Protect route with CRON_SECRET bearer token
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const [delVideos, delFeeds] = await Promise.all([
      prisma.videoCache.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.feedCache.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      deletedVideoCaches: delVideos.count,
      deletedFeedCaches: delFeeds.count,
      cleanedAt: now.toISOString(),
    }, { status: 200 });
  } catch (err) {
    console.error('[API /api/cron/cleanup] Error:', err.message);
    return NextResponse.json({ error: 'Cleanup task failed' }, { status: 500 });
  }
}
