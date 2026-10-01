import { notFound } from 'next/navigation';
import scraper from '../../../lib/scraper.js';
import WatchClient from './WatchClient.js';

export const dynamic = 'force-dynamic';

export default async function WatchPage(props) {
  const params = await props.params;
  const vkey = params?.vkey;

  // Validate vkey format: must be valid alphanumeric identifier
  if (!vkey || typeof vkey !== 'string' || vkey.length < 5 || vkey.length > 50 || /[^a-zA-Z0-9_-]/.test(vkey)) {
    notFound();
  }

  // Pre-validate video existence with scraper
  let exists = false;
  try {
    await scraper.warmup();
    const v = await scraper.videoInfo(vkey);
    if (v && (v.vkey || v.title)) {
      exists = true;
    }
  } catch (err) {
    exists = false;
  }

  if (!exists) {
    notFound();
  }

  return <WatchClient />;
}
