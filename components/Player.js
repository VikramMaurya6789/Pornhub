'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

// Simple, reliable video player - rewritten from scratch.
// Uses minimal hls.js config proven working by diagnostic.
// No complex ABR tuning, no interference - just plays video.
export default function Player({
  vkey,
  title,
  streams,
  poster,
  duration,
  theaterMode,
  onToggleTheater,
  onEnded,
  onPause,
  onTimeUpdate,
  autoplayNext,
  onToggleAutoplay,
  initialTime,
  compact,
  onExpand,
  onQueuePlay,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const hideTimer = useRef(null);

  const streamUrl = streams?.[0]?.url || null;
  const qualities = (streams || []).map(s => s.quality).filter(Boolean);

  // Pick 720p (or closest) as default for fast start - 1080p buffers too slowly via proxy
  const defaultStreamUrl = (() => {
    if (!streams?.length) return null;
    const q720 = streams.find(s => String(s.quality) === '720');
    const q480 = streams.find(s => String(s.quality) === '480');
    return (q720 || q480 || streams[0])?.url || null;
  })();

  // Setup hls.js - SIMPLE, like the working diagnostic
  useEffect(() => {
    const video = videoRef.current;
    const url = defaultStreamUrl || streamUrl;
    if (!video || !url) return;

    // Cleanup previous
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = url.includes('.m3u8') || url.includes('/api/hls');

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('[SimplePlayer] Fatal HLS error:', data.details);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else {
      video.src = url;
    }

    // Restore position
    if (initialTime > 0) {
      video.currentTime = initialTime;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  // Handle quality change - reload with selected stream
  const handleQualityChange = (q) => {
    setSelectedQuality(q);
    setShowQualityMenu(false);
    const video = videoRef.current;
    if (!video) return;
    const wasPlaying = !video.paused;
    const pos = video.currentTime;
    let url = streamUrl;
    if (q !== 'auto') {
      const match = (streams || []).find(s => String(s.quality) === String(q));
      if (match) url = match.url;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const isHls = url.includes('.m3u8') || url.includes('/api/hls');
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      video.src = url;
    }
    video.currentTime = pos;
    if (wasPlaying) video.play().catch(() => {});
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch((e) => {
        // If play fails (e.g. not muted), try muted
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {});
      });
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video || !videoDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = pos * videoDuration;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const el = videoRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  };

  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div
      className="relative w-full bg-black rounded-xl overflow-hidden group"
      style={{ aspectRatio: '16/9' }}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        preload="auto"
        className="w-full h-full"
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => { setIsPlaying(false); onPause?.({ currentTime: videoRef.current?.currentTime, duration: videoRef.current?.duration }); }}
        onTimeUpdate={(e) => { setCurrentTime(e.target.currentTime); onTimeUpdate?.(e.target.currentTime); }}
        onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
        onEnded={() => { setIsPlaying(false); onEnded?.(); }}
      />

      {/* Big play button */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40"
          aria-label="Play"
        >
          <div className="w-20 h-20 rounded-full bg-[#ff9900] flex items-center justify-center hover:scale-110 transition-transform">
            <svg className="w-10 h-10 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}

      {/* Controls */}
      <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8 transition-opacity ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
        {/* Seek bar */}
        <div className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3" onClick={handleSeek}>
          <div
            className="h-full bg-[#ff9900] rounded-full"
            style={{ width: videoDuration ? `${(currentTime / videoDuration) * 100}%` : '0%' }}
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} className="text-white hover:text-[#ff9900]" aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button onClick={toggleMute} className="text-white hover:text-[#ff9900]" aria-label="Mute">
            {isMuted ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
            )}
          </button>
          <span className="text-white text-sm">{fmt(currentTime)} / {fmt(videoDuration)}</span>
          <div className="flex-1" />
          {/* Quality selector */}
          <div className="relative">
            <button onClick={() => setShowQualityMenu(!showQualityMenu)} className="text-white text-sm hover:text-[#ff9900] px-2">
              {selectedQuality === 'auto' ? 'Auto' : `${selectedQuality}p`}
            </button>
            {showQualityMenu && (
              <div className="absolute bottom-8 right-0 bg-black/90 rounded-lg py-1 min-w-[100px]">
                <button onClick={() => handleQualityChange('auto')} className="block w-full text-left px-4 py-1.5 text-white text-sm hover:bg-white/10">Auto</button>
                {qualities.map(q => (
                  <button key={q} onClick={() => handleQualityChange(q)} className="block w-full text-left px-4 py-1.5 text-white text-sm hover:bg-white/10">{q}p</button>
                ))}
              </div>
            )}
          </div>
          {onToggleTheater && (
            <button onClick={onToggleTheater} className="text-white hover:text-[#ff9900]" aria-label="Theater mode">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" /></svg>
            </button>
          )}
          <button onClick={toggleFullscreen} className="text-white hover:text-[#ff9900]" aria-label="Fullscreen">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
