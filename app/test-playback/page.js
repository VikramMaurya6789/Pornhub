'use client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function TestPlayback() {
  const videoRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [streamUrl, setStreamUrl] = useState('');

  const log = (msg) => {
    setLogs(prev => [...prev, `${new Date().toISOString().slice(11, 23)} ${msg}`]);
  };

  useEffect(() => {
    const run = async () => {
      try {
        log('Fetching /api/video...');
        const r = await fetch('/api/video?vkey=68b917d5aa34f');
        const j = await r.json();
        log(`API OK, ${j.streams?.length} streams`);
        const url = j.streams?.[0]?.url;
        setStreamUrl(url);
        log(`Stream URL: ${url?.slice(0, 80)}...`);

        // Test 1: Fetch playlist directly
        log('Test 1: Fetching playlist via fetch()...');
        const pr = await fetch(url);
        const ptext = await pr.text();
        log(`Playlist fetch: HTTP ${pr.status}, ${ptext.length} bytes`);
        log(`Playlist start: ${ptext.slice(0, 100).replace(/\n/g, '|')}`);

        // Test 2: hls.js
        log('Test 2: hls.js setup...');
        log(`Hls.isSupported() = ${Hls.isSupported()}`);
        const video = videoRef.current;
        if (!Hls.isSupported()) {
          log('HLS NOT SUPPORTED, trying native...');
          video.src = url;
          return;
        }
        const hls = new Hls({ enableWorker: false, debug: false });
        hls.on(Hls.Events.MANIFEST_PARSED, () => log('EVENT: MANIFEST_PARSED'));
        hls.on(Hls.Events.LEVEL_LOADED, () => log('EVENT: LEVEL_LOADED'));
        hls.on(Hls.Events.FRAG_LOADED, () => log('EVENT: FRAG_LOADED'));
        hls.on(Hls.Events.FRAG_BUFFERED, () => log('EVENT: FRAG_BUFFERED'));
        hls.on(Hls.Events.ERROR, (e, data) => log(`EVENT: ERROR fatal=${data.fatal} type=${data.type} details=${data.details}`));
        hls.loadSource(url);
        hls.attachMedia(video);
        log('hls.js loadSource+attachMedia done, waiting...');

        // Test 3: Try play after 5s
        setTimeout(() => {
          log(`Video state: paused=${video.paused} readyState=${video.readyState} currentTime=${video.currentTime}`);
          video.play().then(() => log('video.play() resolved')).catch(e => log(`video.play() rejected: ${e.message}`));
        }, 5000);

        // Final state after 15s
        setTimeout(() => {
          log(`FINAL: paused=${video.paused} readyState=${video.readyState} currentTime=${video.currentTime} buffered=${video.buffered?.length}`);
        }, 15000);
      } catch (e) {
        log(`ERROR: ${e.message}`);
      }
    };
    run();
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', background: '#000', color: '#0f0', minHeight: '100vh' }}>
      <h1>Playback Diagnostic</h1>
      <video ref={videoRef} controls style={{ width: '100%', maxWidth: 640, background: '#111' }} playsInline />
      <div style={{ marginTop: 20, whiteSpace: 'pre-wrap', fontSize: 12 }}>
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
