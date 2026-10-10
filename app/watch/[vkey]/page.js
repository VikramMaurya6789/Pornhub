import { notFound } from 'next/navigation';
import WatchClient from './WatchClient.js';

export const dynamic = 'force-dynamic';

export default async function WatchPage(props) {
  const params = await props.params;
  const vkey = params?.vkey;

  // Validate vkey format: must be valid alphanumeric identifier.
  // Video existence is already validated by the watch layout (which 404s
  // unknown videos), so no slow re-fetch here — keeps navigation snappy.
  if (!vkey || typeof vkey !== 'string' || vkey.length < 5 || vkey.length > 50 || /[^a-zA-Z0-9_-]/.test(vkey)) {
    notFound();
  }

  return <WatchClient key={vkey} />;
}
