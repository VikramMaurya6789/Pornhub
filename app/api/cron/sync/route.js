import { NextResponse } from 'next/server';
import scraper from '../../../../lib/scraper.js';

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    // Optional CRON_SECRET verification if configured, otherwise allow Vercel cron
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await scraper.autoSyncNewVideos();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Cron sync failed' }, { status: 500 });
  }
}
