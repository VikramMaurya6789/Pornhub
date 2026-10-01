import { NextResponse } from 'next/server';
import scraper from '../../../lib/scraper.js';

export async function GET() {
  try {
    const result = await scraper.autoSyncNewVideos();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Auto sync failed' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await scraper.autoSyncNewVideos();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Auto sync failed' }, { status: 500 });
  }
}
