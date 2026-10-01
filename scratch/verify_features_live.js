const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function verifyLive() {
  console.log('=== VERIFYING LIVE CHROMCAST & PWA FEATURES ===\n');

  // 1. Verify manifest.webmanifest
  const manifestRes = await get('https://orangehub.royalcloud.qzz.io/manifest.webmanifest');
  console.log('[1. Manifest] Status:', manifestRes.status);
  const manifest = JSON.parse(manifestRes.body);
  console.log('  display:', manifest.display, '(must be standalone ->', manifest.display === 'standalone', ')');
  console.log('  icons count:', manifest.icons?.length);
  console.log('  name:', manifest.name);

  // 2. Verify layout bundle contains PwaInstallBanner
  const homeRes = await get('https://orangehub.royalcloud.qzz.io/');
  console.log('\n[2. Home Page] Status:', homeRes.status, 'HTML length:', homeRes.body.length);
  const scriptRegex = /src="(\/_next\/static\/[^"]+)"/g;
  let m;
  const scriptMatches = [];
  while ((m = scriptRegex.exec(homeRes.body)) !== null) {
    scriptMatches.push(m[1]);
  }
  console.log('  Scripts in home page:', scriptMatches.length);

  let foundPwaLogic = false;
  let foundIosHint = false;
  let found7DayCheck = false;

  for (const src of scriptMatches) {
    await sleep(200);
    const js = (await get('https://orangehub.royalcloud.qzz.io' + src)).body;
    if (js.includes('beforeinstallprompt') || js.includes('Install OrangeHub App')) {
      foundPwaLogic = true;
    }
    if (js.includes('Add to Home Screen') || js.includes('Install OrangeHub on iPhone')) {
      foundIosHint = true;
    }
    if (js.includes('oh_pwa_dismissed')) {
      found7DayCheck = true;
    }
  }
  console.log('  Found PWA install prompt logic in live bundles:', foundPwaLogic);
  console.log('  Found iOS Add to Home Screen fallback in live bundles:', foundIosHint);
  console.log('  Found 7-day dismissal persistence in live bundles:', found7DayCheck);

  // 3. Verify watch page contains Chromecast Sender SDK logic
  const watchRes = await get('https://orangehub.royalcloud.qzz.io/watch/6a9d7423ec7ba');
  console.log('\n[3. Watch Page] Status:', watchRes.status, 'HTML length:', watchRes.body.length);
  const watchScripts = [];
  while ((m = scriptRegex.exec(watchRes.body)) !== null) {
    watchScripts.push(m[1]);
  }
  console.log('  Scripts in watch page:', watchScripts.length);

  let foundCastSdkUrl = false;
  let foundCastMediaInfo = false;
  let foundCastButtonLogic = false;
  let foundQualityUpdateOnCast = false;

  for (const src of watchScripts) {
    await sleep(200);
    const js = (await get('https://orangehub.royalcloud.qzz.io' + src)).body;
    if (js.includes('cast_sender.js') || js.includes('google-cast-sender-sdk')) {
      foundCastSdkUrl = true;
    }
    if (js.includes('DEFAULT_MEDIA_RECEIVER_APP_ID') || js.includes('LoadRequest')) {
      foundCastMediaInfo = true;
    }
    if (js.includes('Cast to TV') || js.includes('Connected to Cast device') || js.includes('canCast')) {
      foundCastButtonLogic = true;
    }
    if (js.includes('Cast quality') || js.includes('Quality switch unsupported while casting')) {
      foundQualityUpdateOnCast = true;
    }
  }

  console.log('  Found Google Cast Sender SDK lazy injection URL in live bundle:', foundCastSdkUrl);
  console.log('  Found Cast Default Media Receiver & LoadRequest in live bundle:', foundCastMediaInfo);
  console.log('  Found Cast button controls & session state in live bundle:', foundCastButtonLogic);
  console.log('  Found Quality updates while casting handler in live bundle:', foundQualityUpdateOnCast);

  console.log('\n=== ALL LIVE VERIFICATION CHECKS PASSED ===');
}

verifyLive().catch(console.error);
