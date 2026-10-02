'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  IconPlay, IconPause, IconVolume, IconVolumeLow, IconVolumeMute,
  IconFullscreen, IconFullscreenExit, IconPip, IconTheater, IconCast,
  IconSpeed, IconSettings, IconAlert, IconSparkles,
  IconSpinner, IconX, IconCheck, IconMoon, IconSun, IconArrowUp,
  IconRefresh, IconList
} from './Icons';
import { haptic } from '../lib/haptics';
import { getQueue, removeFromQueue, clearQueue, QUEUE_CHANGED_EVENT } from '../lib/queue';

function parseDurationToSec(d) {
  if (!d) return 0;
  if (typeof d === 'number') return isNaN(d) || d <= 0 ? 0 : Math.round(d);
  const s = String(d).trim();
  if (!s || s === '0:00' || s === '--:--' || s === '0') return 0;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function formatDuration(secs) {
  if (!secs || isNaN(secs) || secs <= 0) return '--:--';
  const rounded = Math.round(secs);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

export default function Player({
  vkey,
  title,
  streams = [],
  poster,
  duration: propDuration = 0,
  theaterMode = false,
  onToggleTheater,
  onEnded,
  onPause,
  onTimeUpdate,
  autoplay = false,
  autoplayNext = true,
  onToggleAutoplay,
  initialTime = 0,
  compact = false, // floating mini-player mode: minimal controls
  onExpand, // called when the expand button is tapped in compact mode
  onQueuePlay, // called with vkey when a queued video is tapped (defaults to location nav)
}) {
  const [quality, setQuality] = useState('auto');
  const [qualityIndex, setQualityIndex] = useState(0);

  const canonicalDurationSec = useMemo(() => parseDurationToSec(propDuration), [propDuration]);
  const canonicalDurationRef = useRef(canonicalDurationSec);
  const durationMismatchWarnedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => canonicalDurationSec || 0);

  useEffect(() => {
    canonicalDurationRef.current = canonicalDurationSec;
    durationMismatchWarnedRef.current = false;
    if (canonicalDurationSec > 0) {
      setDuration(canonicalDurationSec);
    }
  }, [canonicalDurationSec]);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const playbackRateRef = useRef(1);
  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);
  // Loop single video (session-only, like YouTube's loop)
  const [loop, setLoop] = useState(false);
  // Up-next queue panel
  const [queue, setQueue] = useState([]);
  const [showQueue, setShowQueue] = useState(false);
  // Double-tap-and-hold 2x speed gesture
  const [is2xHold, setIs2xHold] = useState(false);
  const hold2xRef = useRef(null); // { timer } | { active: true }
  const suppressTapRef = useRef(0); // timestamp — suppresses the tap after a 2x hold
  const autoFsRef = useRef(false); // true when WE entered fullscreen due to rotation
  const compactRef = useRef(compact);
  useEffect(() => {
    compactRef.current = compact;
  }, [compact]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isAutoplay, setIsAutoplay] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('oh_autoplay');
      if (stored !== null) return stored === '1';
    }
    return autoplayNext !== undefined ? autoplayNext : true;
  });

  useEffect(() => {
    if (autoplayNext !== undefined) {
      setIsAutoplay(autoplayNext);
    }
  }, [autoplayNext]);

  const toggleAutoplaySetting = () => {
    const nextVal = !isAutoplay;
    setIsAutoplay(nextVal);
    try {
      localStorage.setItem('oh_autoplay', nextVal ? '1' : '0');
    } catch {}
    if (onToggleAutoplay) onToggleAutoplay(nextVal);
  };

  // Ambient light (video glow) — default ON, persisted in localStorage
  const [ambientEnabled, setAmbientEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('oh_ambient');
      if (stored !== null) return stored === '1';
    } catch {}
    return true;
  });
  const [ambientColor, setAmbientColor] = useState('rgb(255, 153, 0)');
  const ambientCanvasRef = useRef(null);
  const ambientGlowRef = useRef(null);
  const ambientTaintedRef = useRef(false);

  const toggleAmbient = () => {
    const nextVal = !ambientEnabled;
    setAmbientEnabled(nextVal);
    try {
      localStorage.setItem('oh_ambient', nextVal ? '1' : '0');
    } catch {}
  };

  // Ambient light sampler: draws the video to a tiny offscreen canvas every
  // animation frame (up to 60fps) and paints the average color onto the glow
  // div via ref (no re-render). At 64x36 the per-frame cost is negligible.
  // Cross-origin streams taint the canvas — getImageData then throws, in which
  // case sampling stops and the static brand-orange glow remains. Playback is
  // never touched (no crossOrigin attribute is set on the video element).
  useEffect(() => {
    if (!ambientEnabled || ambientTaintedRef.current) return;
    const video = videoRef.current;
    const canvas = ambientCanvasRef.current;
    if (!video || !canvas) return;
    let ctx = null;
    try {
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    } catch {
      return;
    }
    if (!ctx) return;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let stopped = false;
    const sample = () => {
      if (stopped) return;
      raf = requestAnimationFrame(sample);
      if (video.paused || video.ended || video.readyState < 2) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 32) {
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
        if (n > 0 && ambientGlowRef.current) {
          ambientGlowRef.current.style.backgroundColor =
            `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
        }
      } catch (e) {
        // Tainted canvas (cross-origin video) — stop sampling, keep static glow
        ambientTaintedRef.current = true;
        stopped = true;
        cancelAnimationFrame(raf);
        return;
      }
      if (reducedMotion) {
        stopped = true;
        cancelAnimationFrame(raf);
      }
    };
    raf = requestAnimationFrame(sample);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [ambientEnabled]);

  const [bufferedEnd, setBufferedEnd] = useState(0);

  // Mobile double-tap feedback indicators
  const [seekFeedback, setSeekFeedback] = useState(null); // { side: 'left' | 'right', text: '-10s' | '+10s' }
  const [swipeUI, setSwipeUI] = useState(null); // { type: 'volume' | 'brightness', pct: 0-100 }
  const swipeRef = useRef(null); // { x0, y0, side, active, startVol, startBright }
  const swipeEndRef = useRef(0); // timestamp of last swipe end (suppresses the follow-up tap)
  const swipeHideTimeoutRef = useRef(null);
  const brightnessRef = useRef(1);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const scrubberRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const lastTimeRef = useRef(0);
  const lastTapRef = useRef({ time: 0, x: 0 });
  const singleTapTimeoutRef = useRef(null);
  const isDraggingSeekRef = useRef(false);
  const lastToggleRef = useRef(0);
  const isTouchInteractionRef = useRef(false);
  const touchResetTimeoutRef = useRef(null);
  const resumeTimeRef = useRef(0);
  const resumePlayingRef = useRef(false);
  const handleStreamErrorRef = useRef(null);
  const hasAppliedInitialTimeRef = useRef(false);
  const [canCast, setCanCast] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const castSessionRef = useRef(null);
  const castConfirmedRef = useRef(false);
  const [playerToast, setPlayerToast] = useState(null);
  const playerToastTimeoutRef = useRef(null);

  const showPlayerToast = useCallback((msg) => {
    if (playerToastTimeoutRef.current) clearTimeout(playerToastTimeoutRef.current);
    setPlayerToast(msg);
    playerToastTimeoutRef.current = setTimeout(() => {
      setPlayerToast(null);
    }, 3000);
  }, []);

  const [sleepTimerMins, setSleepTimerMins] = useState(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null);
  const [sleepNotice, setSleepNotice] = useState(null);

  // Playhead position stability, regression guard, and quality tracking refs
  const prevVkeyRef = useRef(null);
  const isInitializedRef = useRef(false);
  const lastKnownGoodTimeRef = useRef(0);
  const savedPositionRef = useRef(0);
  const wasPausedRef = useRef(true);
  const isUserSeekingRef = useRef(false);
  const userSeekResetTimeoutRef = useRef(null);

  // Stale-frame-on-seek and debounce tracking refs
  const isSeekingRef = useRef(false);
  const seekDebounceTimeoutRef = useRef(null);
  const pendingSeekTargetRef = useRef(null);
  const wasPausedBeforeSeekRef = useRef(false);
  const isMicroNudgingRef = useRef(false);
  const isPlayingRef = useRef(false);
  const handleSeekedOrPlayingRef = useRef(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (seekDebounceTimeoutRef.current) {
        clearTimeout(seekDebounceTimeoutRef.current);
      }
      if (userSeekResetTimeoutRef.current) {
        clearTimeout(userSeekResetTimeoutRef.current);
      }
    };
  }, []);

  const initialAutoIndexRef = useRef(0);
  const hasStartedPlaybackRef = useRef(false);
  const lastWorkingQualityRef = useRef(null);
  const failedQualitiesRef = useRef(new Set());
  const healthyBufferSecondsRef = useRef(0);
  const lastDowngradeRef = useRef(0);
  const seekingTimeoutRef = useRef(null);
  const tokenRefreshAttemptedRef = useRef(false);

  const [internalStreams, setInternalStreams] = useState(streams);
  useEffect(() => {
    if (streams && streams.length > 0) {
      setInternalStreams((prev) => {
        if (
          prev &&
          prev.length === streams.length &&
          prev.every((s, i) => s.quality === streams[i]?.quality && s.url === streams[i]?.url)
        ) {
          return prev;
        }
        return streams;
      });
    }
  }, [streams]);

  const qualities = useMemo(() => (internalStreams || []).map((s) => s.quality), [internalStreams]);

  // Compute smart Auto initial quality level
  // Initial pick = 720p on desktop, 480p when saveData is true OR effectiveType is '2g'/'3g'/'slow-2g' OR player width < 640px
  const computeInitialAutoIndex = useCallback((streamList) => {
    if (!streamList || !streamList.length) return 0;

    let isSlow = false;
    if (typeof navigator !== 'undefined' && navigator.connection) {
      const conn = navigator.connection;
      if (conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType)) {
        isSlow = true;
      }
    }

    const container = containerRef.current;
    const renderedWidth = container
      ? container.getBoundingClientRect().width
      : (typeof window !== 'undefined' ? window.innerWidth : 1024);

    if (renderedWidth > 0 && renderedWidth < 640) {
      isSlow = true;
    }

    const targetHeight = isSlow ? 480 : 720;

    // Streams are ordered high to low (e.g. 1080, 720, 480, 240)
    let chosenIdx = -1;
    for (let i = 0; i < streamList.length; i++) {
      const qNum = parseInt(streamList[i].quality, 10);
      if (!isNaN(qNum) && qNum <= targetHeight) {
        chosenIdx = i;
        break;
      }
    }

    if (chosenIdx === -1) {
      chosenIdx = streamList.length - 1; // lowest available
    }

    return chosenIdx;
  }, []);

  // Initialize ONLY when vkey changes (never reset while same vkey is open)
  useEffect(() => {
    if (prevVkeyRef.current !== vkey) {
      prevVkeyRef.current = vkey;
      isInitializedRef.current = false;
      hasAppliedInitialTimeRef.current = false;
      hasStartedPlaybackRef.current = false;
      lastKnownGoodTimeRef.current = initialTime || 0;
      savedPositionRef.current = initialTime || 0;
      healthyBufferSecondsRef.current = 0;
      tokenRefreshAttemptedRef.current = false;
      failedQualitiesRef.current.clear();
      setHasError(false);
    }
  }, [vkey, initialTime]);

  // Perform initial quality pick once when streams become available for the current video
  useEffect(() => {
    if (!isInitializedRef.current && internalStreams && internalStreams.length > 0) {
      isInitializedRef.current = true;
      const initIdx = computeInitialAutoIndex(internalStreams);
      initialAutoIndexRef.current = initIdx;
      if (quality === 'auto') {
        setQualityIndex(initIdx);
      }
    }
  }, [internalStreams, quality, computeInitialAutoIndex]);

  const currentSrc = useMemo(() => {
    if (!internalStreams || !internalStreams.length) return null;
    if (quality === 'auto') {
      const target = internalStreams[qualityIndex] || internalStreams[0];
      return target?.url;
    }
    const match = internalStreams.find((s) => s.quality === quality);
    return match ? match.url : internalStreams[0]?.url;
  }, [internalStreams, quality, qualityIndex]);

  const activeQualityLabel = useMemo(() => {
    if (quality === 'auto') {
      const current = internalStreams[qualityIndex];
      return current ? `Auto (${current.quality}p)` : 'Auto';
    }
    return `${quality}p`;
  }, [quality, qualityIndex, internalStreams]);

  // Rebuffering stall step-down monitor for Auto mode
  const handleAutoRebufferStall = useCallback(() => {
    if (quality !== 'auto' || !internalStreams || internalStreams.length <= 1) return;

    const now = Date.now();
    if (now - lastDowngradeRef.current < 4000) return; // 4s cooldown
    lastDowngradeRef.current = now;
    healthyBufferSecondsRef.current = 0;

    const video = videoRef.current;
    if (video && video.currentTime > 0) {
      savedPositionRef.current = video.currentTime;
      lastKnownGoodTimeRef.current = video.currentTime;
    }

    if (qualityIndex < internalStreams.length - 1) {
      // Find next lower quality that has not failed
      let nextIdx = -1;
      for (let i = qualityIndex + 1; i < internalStreams.length; i++) {
        const q = internalStreams[i]?.quality;
        if (q && !failedQualitiesRef.current.has(q)) {
          nextIdx = i;
          break;
        }
      }

      if (nextIdx !== -1) {
        console.warn(`[Player] Auto step-down from ${internalStreams[qualityIndex]?.quality}p to ${internalStreams[nextIdx]?.quality}p due to rebuffering`);
        setIsBuffering(true);
        setQualityIndex(nextIdx);
      }
    }
  }, [quality, qualityIndex, internalStreams]);

  // Monitor healthy buffer for stepping back up in Auto mode
  // If 20s pass with healthy buffer (>= 10s ahead), step back up (never above initial pick without user action)
  useEffect(() => {
    if (!isPlaying || quality !== 'auto') return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || isBuffering) {
        healthyBufferSecondsRef.current = 0;
        return;
      }

      let bufferAhead = 0;
      if (video.buffered && video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
            bufferAhead = video.buffered.end(i) - video.currentTime;
            break;
          }
        }
      }

      if (bufferAhead >= 10) {
        healthyBufferSecondsRef.current += 1;
        if (healthyBufferSecondsRef.current >= 20) {
          healthyBufferSecondsRef.current = 0;
          // Never step above the initial pick without user action
          if (qualityIndex > initialAutoIndexRef.current) {
            const higherIdx = qualityIndex - 1;
            const targetQuality = internalStreams[higherIdx]?.quality;
            const targetQNum = parseInt(targetQuality, 10);

            // Cap level to player size for manual levels
            const container = containerRef.current;
            const renderedWidth = container
              ? container.getBoundingClientRect().width
              : (typeof window !== 'undefined' ? window.innerWidth : 1024);

            if (renderedWidth > 0 && renderedWidth < 640 && targetQNum > 480) {
              return; // Capped to player size (max 480p on width < 640px)
            }
            if (renderedWidth > 0 && renderedWidth < 1280 && targetQNum > 720) {
              return; // Capped to player size (max 720p on width < 1280px)
            }

            // Check bandwidth estimate allows
            if (typeof navigator !== 'undefined' && navigator.connection) {
              const conn = navigator.connection;
              if (conn.saveData) return;
              if (['slow-2g', '2g', '3g'].includes(conn.effectiveType)) return;
              if (conn.downlink && conn.downlink < 2.5 && targetQNum >= 720) return;
            }

            // Check hls.js bandwidth estimate if available
            if (hlsRef.current && typeof hlsRef.current.bandwidthEstimate === 'number' && hlsRef.current.bandwidthEstimate > 0) {
              const minBps = targetQNum >= 1080 ? 4500000 : targetQNum >= 720 ? 2200000 : 900000;
              if (hlsRef.current.bandwidthEstimate < minBps) {
                return;
              }
            }

            if (targetQuality && failedQualitiesRef.current.has(targetQuality)) {
              return;
            }

            console.log(`[Player] 20s healthy buffer reached (${bufferAhead.toFixed(1)}s ahead) and bandwidth allows. Auto stepping up to ${targetQuality}p`);
            if (video && video.currentTime > 0) {
              savedPositionRef.current = video.currentTime;
              lastKnownGoodTimeRef.current = video.currentTime;
            }
            setIsBuffering(true);
            setQualityIndex(higherIdx);
          }
        }
      } else {
        healthyBufferSecondsRef.current = 0;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, quality, qualityIndex, isBuffering, internalStreams]);

  // Google Cast Sender SDK - lazily loaded once on watch page, strictly gated on real Cast API & device availability
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SCRIPT_ID = 'google-cast-sender-sdk';
    let isMounted = true;
    let detectionTimeout = null;

    // 5-second timeout: if detection fails or devices not found, keep permanently hidden for this session
    detectionTimeout = setTimeout(() => {
      if (isMounted && !castConfirmedRef.current) {
        setCanCast(false);
      }
    }, 5000);

    const setupCastContext = () => {
      try {
        if (!window.chrome?.cast || !window.cast?.framework?.CastContext) {
          if (isMounted) setCanCast(false);
          return false;
        }

        const context = window.cast.framework.CastContext.getInstance();
        if (!context) {
          if (isMounted) setCanCast(false);
          return false;
        }

        context.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });

        // Device availability verification: check CastState (NO_DEVICES_AVAILABLE means no casting possible)
        const updateFromCastState = (state) => {
          if (!isMounted) return;
          const noDevices =
            !state ||
            state === window.cast.framework.CastState?.NO_DEVICES_AVAILABLE ||
            state === 'NO_DEVICES_AVAILABLE';

          if (!noDevices) {
            castConfirmedRef.current = true;
            if (detectionTimeout) clearTimeout(detectionTimeout);
            setCanCast(true);
          } else {
            setCanCast(false);
          }
        };

        // Listen for Cast device availability changes
        context.addEventListener(
          window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          (event) => {
            updateFromCastState(event.castState);
          }
        );

        // Listen for session state changes
        context.addEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          (event) => {
            if (!isMounted) return;
            const sState = event.sessionState;
            if (
              sState === window.cast.framework.SessionState.SESSION_STARTED ||
              sState === window.cast.framework.SessionState.SESSION_RESUMED
            ) {
              setIsCasting(true);
              castSessionRef.current = context.getCurrentSession();
              showPlayerToast('Connected to Cast device');
            } else if (
              sState === window.cast.framework.SessionState.SESSION_ENDED ||
              sState === window.cast.framework.SessionState.SESSION_ENDING
            ) {
              setIsCasting(false);
              castSessionRef.current = null;
              showPlayerToast('Cast session ended');
            }
          }
        );

        // Query initial CastState
        updateFromCastState(context.getCastState());
        return true;
      } catch {
        if (isMounted) setCanCast(false);
        return false;
      }
    };

    // If Cast framework is already ready in window
    if (window.chrome?.cast && window.cast?.framework?.CastContext) {
      setupCastContext();
    } else {
      // Callback invoked by the Cast Sender SDK
      const prevCallback = window.__onGCastApiAvailable;
      window.__onGCastApiAvailable = (isAvailable) => {
        if (typeof prevCallback === 'function') {
          try { prevCallback(isAvailable); } catch {}
        }
        if (isAvailable && isMounted) {
          setupCastContext();
        } else if (isMounted) {
          setCanCast(false);
        }
      };

      // Lazy load the Cast script only once on watch page
      if (!document.getElementById(SCRIPT_ID)) {
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
        script.async = true;
        script.onerror = () => {
          if (isMounted) setCanCast(false);
        };
        document.body.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
      if (detectionTimeout) clearTimeout(detectionTimeout);
    };
  }, [showPlayerToast]);

  const handleCast = async () => {
    if (typeof window === 'undefined') return;

    if (!window.chrome || !window.chrome.cast || !window.cast?.framework) {
      showPlayerToast('Cast API unavailable on this device');
      return;
    }

    try {
      const context = window.cast.framework.CastContext.getInstance();
      let session = context.getCurrentSession();
      if (!session) {
        await context.requestSession();
        session = context.getCurrentSession();
      }

      if (!session) return; // User closed device picker dialog

      const vid = videoRef.current;
      const mediaUrl = currentSrc
        ? (currentSrc.startsWith('http') ? currentSrc : new URL(currentSrc, window.location.origin).href)
        : (vid?.src ? (vid.src.startsWith('http') ? vid.src : new URL(vid.src, window.location.origin).href) : '');

      if (!mediaUrl) {
        showPlayerToast('No active video stream to cast');
        return;
      }

      const isHls = mediaUrl.includes('.m3u8') || mediaUrl.includes('/api/hls');
      const contentType = isHls ? 'application/x-mpegurl' : 'video/mp4';

      const mediaInfo = new window.chrome.cast.media.MediaInfo(mediaUrl, contentType);
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = title || 'OrangeHub Video';

      if (poster) {
        const thumbUrl = poster.startsWith('http')
          ? (poster.includes('/api/img') ? poster : `${window.location.origin}/api/img?u=${encodeURIComponent(poster)}`)
          : new URL(poster, window.location.origin).href;
        mediaInfo.metadata.images = [new window.chrome.cast.Image(thumbUrl)];
      }

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      request.currentTime = vid ? (vid.currentTime || 0) : currentTime;
      request.autoplay = isPlaying || true;

      session.loadMedia(request).then(
        () => {
          setIsCasting(true);
          castSessionRef.current = session;
          if (vid && !vid.paused) {
            vid.pause();
          }
          showPlayerToast('Casting video to TV');
        },
        (err) => {
          console.warn('[Cast] LoadMedia error:', err);
          showPlayerToast('Failed to load media on Cast device');
        }
      );
    } catch (err) {
      if (err !== 'cancel' && err?.message !== 'cancel') {
        console.warn('[Cast] Cast request error:', err);
      }
    }
  };

  // Sleep timer countdown
  useEffect(() => {
    if (!sleepTimerMins) {
      setSleepTimerRemaining(null);
      return;
    }
    setSleepTimerRemaining(sleepTimerMins * 60);
    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          if (videoRef.current) {
            videoRef.current.pause();
          }
          setIsPlaying(false);
          setSleepTimerMins(null);
          setSleepNotice('Sleep timer reached — playback paused automatically.');
          setTimeout(() => setSleepNotice(null), 5000);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerMins]);

  // Restore persistent settings on mount
  useEffect(() => {
    try {
      const savedVol = localStorage.getItem('oh_vol');
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) setVolume(parsed);
      }
      const savedMuted = localStorage.getItem('oh_muted');
      if (savedMuted !== null) setIsMuted(savedMuted === '1');

      const savedRate = localStorage.getItem('oh_rate');
      if (savedRate !== null) {
        const parsedRate = parseFloat(savedRate);
        if (!isNaN(parsedRate) && [0.5, 0.75, 1, 1.25, 1.5, 2].includes(parsedRate)) {
          setPlaybackRate(parsedRate);
        }
      }
      const savedQuality = localStorage.getItem('oh_quality');
      if (savedQuality) setQuality(savedQuality);

      const savedBright = localStorage.getItem('oh_brightness');
      if (savedBright !== null) {
        const parsedBright = parseFloat(savedBright);
        if (!isNaN(parsedBright) && parsedBright >= 0.4 && parsedBright <= 1.4) {
          brightnessRef.current = parsedBright;
          if (videoRef.current && parsedBright !== 1) {
            videoRef.current.style.filter = `brightness(${parsedBright.toFixed(2)})`;
          }
        }
      }
    } catch {}
  }, []);

  // Fatal error step-down fallback: never retries a failed level in the same session
  const handleStreamError = useCallback(async () => {
    const currentQ = (quality === 'auto')
      ? internalStreams[qualityIndex]?.quality
      : quality;

    if (currentQ) {
      failedQualitiesRef.current.add(currentQ);
    }

    // Step down to next untried quality
    let nextIdx = -1;
    for (let i = qualityIndex + 1; i < (internalStreams || []).length; i++) {
      const q = internalStreams[i]?.quality;
      if (q && !failedQualitiesRef.current.has(q)) {
        nextIdx = i;
        break;
      }
    }

    // If no lower untried, check if any untried exists anywhere in the list
    if (nextIdx === -1) {
      for (let i = (internalStreams || []).length - 1; i >= 0; i--) {
        const q = internalStreams[i]?.quality;
        if (q && !failedQualitiesRef.current.has(q)) {
          nextIdx = i;
          break;
        }
      }
    }

    if (nextIdx !== -1) {
      console.warn(`[Player] Quality ${currentQ} failed, stepping down to untried ${internalStreams[nextIdx]?.quality}p`);
      setIsBuffering(true);
      setQualityIndex(nextIdx);
      if (quality !== 'auto') {
        setQuality(internalStreams[nextIdx]?.quality);
      }
      setHasError(false);
    } else {
      // Attempt seamless token renewal before showing notice if not yet attempted
      if (vkey && !tokenRefreshAttemptedRef.current) {
        tokenRefreshAttemptedRef.current = true;
        try {
          const r = await fetch(`/api/video?vkey=${encodeURIComponent(vkey)}&refresh=1`);
          if (r.ok) {
            const data = await r.json();
            if (data.streams && data.streams.length > 0) {
              failedQualitiesRef.current.clear();
              setInternalStreams(data.streams);
              setQualityIndex(computeInitialAutoIndex(data.streams));
              setHasError(false);
              return;
            }
          }
        } catch {}
      }
      console.warn('[Player] All stream qualities failed, showing reconnection overlay');
      setHasError(true);
      setErrorMsg('Video connection interrupted. Click Retry to reconnect to the stream.');
    }
  }, [qualityIndex, internalStreams, vkey, quality, computeInitialAutoIndex]);

  handleStreamErrorRef.current = handleStreamError;

  // Retry from last working quality (or lowest untried), never blindly back to 1080p
  const handleRetry = async () => {
    setHasError(false);
    setIsBuffering(true);
    tokenRefreshAttemptedRef.current = false;

    let targetIdx = -1;
    if (lastWorkingQualityRef.current) {
      const idx = internalStreams.findIndex((s) => s.quality === lastWorkingQualityRef.current);
      if (idx !== -1) targetIdx = idx;
    }

    if (targetIdx === -1) {
      // Find lowest untried quality (from end of array to start)
      for (let i = internalStreams.length - 1; i >= 0; i--) {
        if (!failedQualitiesRef.current.has(internalStreams[i]?.quality)) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx === -1) {
      targetIdx = internalStreams.length - 1;
    }

    const retryQuality = internalStreams[targetIdx]?.quality;
    if (retryQuality) {
      failedQualitiesRef.current.delete(retryQuality);
    }

    if (quality === 'auto') {
      setQualityIndex(targetIdx);
    } else if (retryQuality) {
      setQuality(retryQuality);
    }

    if (vkey) {
      try {
        const r = await fetch(`/api/video?vkey=${encodeURIComponent(vkey)}&refresh=1`);
        if (r.ok) {
          const freshData = await r.json();
          if (freshData.streams && freshData.streams.length > 0) {
            setInternalStreams(freshData.streams);
            return;
          }
        }
      } catch {}
    }

    const targetSrc = internalStreams[targetIdx]?.url;
    if (hlsRef.current && targetSrc) {
      try {
        hlsRef.current.loadSource(targetSrc);
        hlsRef.current.startLoad();
      } catch {}
    } else if (videoRef.current) {
      try {
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
      } catch {}
    }
  };

  // HLS / Video source initialization with timestamp & play state preservation
  useEffect(() => {
    if (!currentSrc) return;

    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setIsBuffering(true);

    // Save accurate previous playback position and state before setting new source
    const currentPos = (video.currentTime > 0)
      ? video.currentTime
      : (lastKnownGoodTimeRef.current > 0 ? lastKnownGoodTimeRef.current : (savedPositionRef.current || initialTime || 0));

    if (currentPos > 0) {
      savedPositionRef.current = currentPos;
      lastKnownGoodTimeRef.current = currentPos;
    }

    const wasPlaying = !video.paused || resumePlayingRef.current || isPlaying;
    wasPausedRef.current = !wasPlaying;
    if (wasPlaying) {
      resumePlayingRef.current = true;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = currentSrc.includes('.m3u8') || currentSrc.includes('/api/hls');

    const restorePlaybackState = () => {
      setIsBuffering(false);
      const targetTime = savedPositionRef.current;
      if (targetTime > 0 && video) {
        try {
          if (Math.abs(video.currentTime - targetTime) > 0.5) {
            video.currentTime = targetTime;
          }
        } catch (err) {
          console.warn('[Player] Error restoring currentTime at MANIFEST_PARSED:', err);
        }
      }
      if (!wasPausedRef.current) {
        video.play().catch(() => {});
        resumePlayingRef.current = false;
      }
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        startLevel: -1,
        startPosition: currentPos > 0 ? currentPos : -1,
        autoStartLoad: true,
        capLevelToPlayerSize: true, // Cap level to player size for manual & auto levels

        // Seek & buffer hole configuration
        maxSeekHole: 2, // Max buffer hole size to seek over (seconds)
        seekHoleNudgeDuration: 0.05, // Step size when nudging over a seek hole
        nudgeMaxRetry: 5, // Maximum retries for nudging out of a stall or seek hole
        nudgeOffset: 0.1, // Offset applied when nudging
        maxFragLookUpTolerance: 0.25, // Tolerance when matching fragments to seek time
      });

      hlsRef.current = hls;
      hls.loadSource(currentSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, restorePlaybackState);

      // Preserve position across media attachments (e.g. after recoverMediaError)
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        const targetTime = savedPositionRef.current;
        if (targetTime > 0 && video && Math.abs(video.currentTime - targetTime) > 0.5) {
          try {
            video.currentTime = targetTime;
          } catch {}
        }
      });

      // Verify on first buffer append that position is preserved and MSE didn't clamp to 0
      const handleFirstBuffer = () => {
        const targetTime = savedPositionRef.current;
        if (targetTime > 0 && video && video.currentTime < targetTime - 1) {
          try {
            video.currentTime = targetTime;
          } catch {}
        }
        hls.off(Hls.Events.BUFFER_APPENDED, handleFirstBuffer);
      };
      hls.on(Hls.Events.BUFFER_APPENDED, handleFirstBuffer);

      // When a fragment is appended while seeking in paused state, trigger frame refresh
      const handleBufferAppendedForSeek = () => {
        if (isSeekingRef.current && videoRef.current && (videoRef.current.paused || wasPausedBeforeSeekRef.current) && !isPlayingRef.current) {
          if (handleSeekedOrPlayingRef.current) {
            handleSeekedOrPlayingRef.current();
          }
        }
      };
      hls.on(Hls.Events.BUFFER_APPENDED, handleBufferAppendedForSeek);

      // Rebuffering / stall detection via FRAG_BUFFERED
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (quality === 'auto' && videoRef.current) {
          const vid = videoRef.current;
          let bufferAhead = 0;
          if (vid.buffered && vid.buffered.length > 0) {
            for (let i = 0; i < vid.buffered.length; i++) {
              if (vid.buffered.start(i) <= vid.currentTime && vid.buffered.end(i) >= vid.currentTime) {
                bufferAhead = vid.buffered.end(i) - vid.currentTime;
                break;
              }
            }
          }
          if (!vid.paused && hasStartedPlaybackRef.current && (vid.readyState < 3 || bufferAhead < 0.5)) {
            handleAutoRebufferStall();
          }
        }
      });

      let mediaRecoveryCount = 0;
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          const currentPos = video && video.currentTime > 0 ? video.currentTime : lastKnownGoodTimeRef.current;
          if (currentPos > 0) {
            savedPositionRef.current = currentPos;
            lastKnownGoodTimeRef.current = currentPos;
          }
          if (video) {
            wasPausedRef.current = video.paused;
          }
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[Player] HLS network error:', data.details);
              if (data.response && data.response.code >= 400) {
                hls.destroy();
                if (handleStreamErrorRef.current) handleStreamErrorRef.current();
              } else {
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              mediaRecoveryCount++;
              console.warn(`[Player] HLS media error (attempt ${mediaRecoveryCount}), recovering...`);
              if (mediaRecoveryCount <= 2) {
                hls.recoverMediaError();
              } else if (mediaRecoveryCount === 3) {
                hls.swapAudioCodec();
                hls.recoverMediaError();
              } else {
                hls.destroy();
                if (handleStreamErrorRef.current) handleStreamErrorRef.current();
              }
              break;
            default:
              console.error('[Player] Fatal HLS error:', data);
              hls.destroy();
              if (handleStreamErrorRef.current) handleStreamErrorRef.current();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      // Safari native HLS path: preserve currentTime and paused/playing state across quality changes
      const handleNativeLoadedMetadata = () => {
        const targetTime = savedPositionRef.current;
        if (targetTime > 0 && video) {
          try {
            video.currentTime = targetTime;
          } catch {}
        }
        if (!wasPausedRef.current) {
          video.play().catch(() => {});
          resumePlayingRef.current = false;
        } else if (!hasStartedPlaybackRef.current && autoplay && video) {
          video.play().catch(() => {});
        } else if (video) {
          video.pause();
        }
        setIsBuffering(false);
      };

      video.addEventListener('loadedmetadata', handleNativeLoadedMetadata, { once: true });

      video.src = currentSrc;
      video.onerror = () => {
        if (handleStreamErrorRef.current) handleStreamErrorRef.current();
      };

      try {
        video.load();
      } catch {}
    } else {
      if (handleStreamErrorRef.current) handleStreamErrorRef.current();
    }

    return () => {
      if (video) video.onerror = null;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSrc]);

  // Keep volume, mute and playback rate synced with video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume;
    video.muted = isMuted;
    video.playbackRate = playbackRate;
  }, [volume, isMuted, playbackRate]);

  // Auto-pause video when tab becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Listen to fullscreen changes across browsers
  useEffect(() => {
    const video = videoRef.current;
    const handleFsChange = () => {
      const fs = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        video?.webkitDisplayingFullscreen
      );
      setIsFullscreen(fs);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    const onBegin = () => setIsFullscreen(true);
    const onEnd = () => setIsFullscreen(false);
    if (video) {
      video.addEventListener('webkitbeginfullscreen', onBegin);
      video.addEventListener('webkitendfullscreen', onEnd);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', onBegin);
        video.removeEventListener('webkitendfullscreen', onEnd);
      }
    };
  }, []);

  // Autohide controls after 3s of inactivity while playing
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSettingsMenu && !showSpeedMenu && !showShortcuts) {
          setShowControls(false);
        }
      }, 3000);
    }
  }, [isPlaying, showSettingsMenu, showSpeedMenu, showShortcuts]);

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  // Close menus when clicking outside cleanly using pointerdown
  useEffect(() => {
    if (!showSettingsMenu && !showSpeedMenu && !showQueue) return;
    const handleOutsideClick = (e) => {
      if (
        e.target &&
        e.target.closest &&
        !e.target.closest('.settings-menu-container') &&
        !e.target.closest('.speed-menu-container') &&
        !e.target.closest('.queue-panel-container')
      ) {
        setShowSettingsMenu(false);
        setShowSpeedMenu(false);
        setShowQueue(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [showSettingsMenu, showSpeedMenu, showQueue]);

  // Buffer stall recovery watchdog (gently nudges forward without destroying HLS instance)
  useEffect(() => {
    if (!isPlaying || hasError) return;

    let stallTimer = null;
    if (isBuffering) {
      stallTimer = setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        console.warn('[Player] Buffer stalled, nudging video forward...');
        try {
          if (video.currentTime > 0) {
            video.currentTime = Math.min(duration || 99999, video.currentTime + 0.15);
            video.play().catch(() => {});
          }
        } catch {}
      }, 4000);
    }

    return () => {
      if (stallTimer) clearTimeout(stallTimer);
    };
  }, [isPlaying, isBuffering, hasError, duration]);

  const togglePlay = () => {
    const now = Date.now();
    if (now - lastToggleRef.current < 250) return;
    lastToggleRef.current = now;

    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          console.warn('[Player] Play failed, attempting muted playback:', err);
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
      }
    } else {
      video.pause();
    }
  };

  const handleVideoClick = (e) => {
    // Never pause if clicking controls, menus, buttons, scrubber, or interactive elements
    if (
      e.target &&
      e.target.closest &&
      e.target.closest(
        'button, input, select, a, .control-bar, .scrubber-bar, .settings-menu-container, .speed-menu-container, [data-interactive="true"]'
      )
    ) {
      return;
    }
    if (isTouchInteractionRef.current) {
      return;
    }
    if (showSettingsMenu || showSpeedMenu || showShortcuts) {
      setShowSettingsMenu(false);
      setShowSpeedMenu(false);
      setShowShortcuts(false);
      return;
    }
    togglePlay();
    resetControlsTimeout();
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!container) return;

    const isFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      video?.webkitDisplayingFullscreen
    );

    if (isFs) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen().catch(() => {});
      } else if (video && video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
      }
    } else {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {
          if (video && video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
          }
        });
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (video && video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('[Player] PiP error:', e);
    }
  };

  const updateVolume = (newVol) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    try {
      localStorage.setItem('oh_vol', String(clamped));
      localStorage.setItem('oh_muted', clamped === 0 ? '1' : '0');
    } catch {}
  };

  // Screen brightness for swipe gesture (CSS filter on the video element only;
  // does not affect the ambient-light sampler which reads raw frames).
  const applyBrightness = (val) => {
    const clamped = Math.max(0.4, Math.min(1.4, val));
    brightnessRef.current = clamped;
    try {
      if (videoRef.current) {
        videoRef.current.style.filter = clamped === 1 ? '' : `brightness(${clamped.toFixed(2)})`;
      }
      localStorage.setItem('oh_brightness', String(clamped));
    } catch {}
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
    }
    try {
      localStorage.setItem('oh_muted', nextMuted ? '1' : '0');
      if (!nextMuted && volume === 0) {
        localStorage.setItem('oh_vol', '0.5');
      }
    } catch {}
  };

  const updatePlaybackRate = (rate) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    setShowSettingsMenu(false);
    try {
      localStorage.setItem('oh_rate', String(rate));
    } catch {}
  };

  // Loop single video toggle — applied straight to the media element so the
  // native loop takes over (no 'ended' event fires while looping).
  const toggleLoop = () => {
    const next = !loop;
    setLoop(next);
    haptic();
    try {
      if (videoRef.current) videoRef.current.loop = next;
    } catch {}
  };

  // Keep the media element's loop flag in sync (e.g. after source swaps).
  useEffect(() => {
    try {
      if (videoRef.current) videoRef.current.loop = loop;
    } catch {}
  }, [loop, qualityIndex, streams]);

  // Up-next queue: subscribe to the shared queue store.
  useEffect(() => {
    const load = () => {
      try {
        setQueue(getQueue());
      } catch {
        setQueue([]);
      }
    };
    load();
    window.addEventListener(QUEUE_CHANGED_EVENT, load);
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, load);
  }, []);

  const playQueueItem = (vkey) => {
    if (!vkey) return;
    haptic();
    setShowQueue(false);
    if (onQueuePlay) {
      onQueuePlay(vkey);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/watch/${vkey}`;
    }
  };

  // Landscape auto-fullscreen (mobile): rotating to landscape while playing
  // enters fullscreen; rotating back exits it (only if we entered it).
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const coarse = window.matchMedia('(hover: none) and (pointer: coarse)');
    const onChange = () => {
      try {
        if (!coarse.matches || compactRef.current) return;
        const video = videoRef.current;
        if (!video || video.paused) return;
        if (mq.matches) {
          const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
          if (!isFs) {
            autoFsRef.current = true;
            toggleFullscreen();
          }
        } else if (autoFsRef.current) {
          autoFsRef.current = false;
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      } catch {}
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
    // toggleFullscreen is stable-in-practice (refs only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateQuality = (q) => {
    setHasError(false);
    setIsBuffering(true);
    setQuality(q);
    setShowSettingsMenu(false);
    try {
      localStorage.setItem('oh_quality', q);
    } catch {}

    // Update Cast session if currently casting
    if (isCasting && castSessionRef.current && window.chrome?.cast) {
      try {
        const match = (internalStreams || []).find((s) => s.quality === q);
        const targetUrl = match ? match.url : internalStreams[0]?.url;
        if (targetUrl) {
          const fullUrl = targetUrl.startsWith('http') ? targetUrl : new URL(targetUrl, window.location.origin).href;
          const isHls = fullUrl.includes('.m3u8') || fullUrl.includes('/api/hls');
          const mediaInfo = new window.chrome.cast.media.MediaInfo(fullUrl, isHls ? 'application/x-mpegurl' : 'video/mp4');
          mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
          mediaInfo.metadata.title = title || 'OrangeHub Video';
          if (poster) {
            const thumbUrl = poster.startsWith('http')
              ? (poster.includes('/api/img') ? poster : `${window.location.origin}/api/img?u=${encodeURIComponent(poster)}`)
              : new URL(poster, window.location.origin).href;
            mediaInfo.metadata.images = [new window.chrome.cast.Image(thumbUrl)];
          }
          const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
          const currentMedia = castSessionRef.current.getMediaSession();
          request.currentTime = currentMedia ? currentMedia.getEstimatedTime() : currentTime;
          request.autoplay = true;
          castSessionRef.current.loadMedia(request).then(
            () => showPlayerToast(`Cast quality: ${q}p`),
            () => showPlayerToast('Could not change quality on Cast device')
          );
        }
      } catch {
        showPlayerToast('Quality switch unsupported while casting');
      }
    }
  };

  // Unified debounced seek with frame refresh and in-flight cancel
  const applySeek = useCallback((targetTime) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const clampedTime = Math.max(0, Math.min(duration, targetTime));

    // Cancel in-flight fragment download from previous seek in hls.js
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
      } catch {}
    }

    wasPausedBeforeSeekRef.current = video.paused;
    isUserSeekingRef.current = true;
    lastKnownGoodTimeRef.current = clampedTime;
    savedPositionRef.current = clampedTime;

    try {
      video.currentTime = clampedTime;
    } catch (err) {
      console.warn('[Player] Error setting video.currentTime:', err);
    }

    // Resume loading fragments at targetTime
    if (hlsRef.current) {
      try {
        hlsRef.current.startLoad(clampedTime);
      } catch {}
    }
  }, [duration]);

  const requestSeek = useCallback((targetTime, immediate = false) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const clampedTime = Math.max(0, Math.min(duration, targetTime));

    // Immediately update UI states so scrubber and time display react with 0ms latency
    setCurrentTime(clampedTime);
    setIsBuffering(true);
    setIsSeeking(true);
    isSeekingRef.current = true;
    isUserSeekingRef.current = true;
    lastKnownGoodTimeRef.current = clampedTime;
    savedPositionRef.current = clampedTime;

    pendingSeekTargetRef.current = clampedTime;

    if (seekDebounceTimeoutRef.current) {
      clearTimeout(seekDebounceTimeoutRef.current);
      seekDebounceTimeoutRef.current = null;
    }

    if (immediate) {
      pendingSeekTargetRef.current = null;
      applySeek(clampedTime);
    } else {
      seekDebounceTimeoutRef.current = setTimeout(() => {
        const finalTarget = pendingSeekTargetRef.current !== null ? pendingSeekTargetRef.current : clampedTime;
        pendingSeekTargetRef.current = null;
        applySeek(finalTarget);
      }, 150);
    }
  }, [duration, applySeek]);

  const handleSeekedOrPlaying = useCallback(() => {
    if (seekingTimeoutRef.current) {
      clearTimeout(seekingTimeoutRef.current);
      seekingTimeoutRef.current = null;
    }

    const video = videoRef.current;

    // If paused, force the video decoder to render the frame at the seek target
    if (video && (video.paused || wasPausedBeforeSeekRef.current) && !isPlayingRef.current) {
      isMicroNudgingRef.current = true;

      let finalized = false;
      const finalizePausedSeek = () => {
        if (finalized) return;
        finalized = true;
        try {
          if (!isPlayingRef.current && videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        } catch {}
        isMicroNudgingRef.current = false;
        setIsBuffering(false);
        setIsSeeking(false);
        isSeekingRef.current = false;
      };

      if (typeof video.requestVideoFrameCallback === 'function') {
        try {
          video.requestVideoFrameCallback(() => {
            finalizePausedSeek();
          });
        } catch {}
      }

      // Micro play-pause nudge to kick the decoder pipeline to paint the new frame
      try {
        const playPromise = video.play();
        if (playPromise !== undefined && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              if (!isPlayingRef.current && videoRef.current) {
                try {
                  videoRef.current.pause();
                } catch {}
              }
              if (typeof video.requestVideoFrameCallback !== 'function') {
                finalizePausedSeek();
              }
            })
            .catch(() => {
              finalizePausedSeek();
            });
        } else {
          if (typeof video.requestVideoFrameCallback !== 'function') {
            finalizePausedSeek();
          }
        }
      } catch (err) {
        finalizePausedSeek();
      }

      // Safety timeout so micro-nudge never gets stuck
      setTimeout(finalizePausedSeek, 150);
    } else {
      setIsBuffering(false);
      setIsSeeking(false);
      isSeekingRef.current = false;
    }

    if (userSeekResetTimeoutRef.current) {
      clearTimeout(userSeekResetTimeoutRef.current);
    }
    userSeekResetTimeoutRef.current = setTimeout(() => {
      isUserSeekingRef.current = false;
    }, 600);
  }, []);

  handleSeekedOrPlayingRef.current = handleSeekedOrPlaying;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          resetControlsTimeout();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          resetControlsTimeout();
          break;
        case 'j':
          e.preventDefault();
          if (video) {
            const cur = pendingSeekTargetRef.current !== null ? pendingSeekTargetRef.current : video.currentTime;
            const targetTime = Math.max(0, cur - 10);
            requestSeek(targetTime, false);
          }
          triggerFeedback('left', '-10s');
          resetControlsTimeout();
          break;
        case 'l':
          e.preventDefault();
          if (video) {
            const cur = pendingSeekTargetRef.current !== null ? pendingSeekTargetRef.current : video.currentTime;
            const targetTime = Math.min(duration || 99999, cur + 10);
            requestSeek(targetTime, false);
          }
          triggerFeedback('right', '+10s');
          resetControlsTimeout();
          break;
        case 'arrowleft':
          e.preventDefault();
          if (video) {
            const cur = pendingSeekTargetRef.current !== null ? pendingSeekTargetRef.current : video.currentTime;
            const targetTime = Math.max(0, cur - 5);
            requestSeek(targetTime, false);
          }
          triggerFeedback('left', '-5s');
          resetControlsTimeout();
          break;
        case 'arrowright':
          e.preventDefault();
          if (video) {
            const cur = pendingSeekTargetRef.current !== null ? pendingSeekTargetRef.current : video.currentTime;
            const targetTime = Math.min(duration || 99999, cur + 5);
            requestSeek(targetTime, false);
          }
          triggerFeedback('right', '+5s');
          resetControlsTimeout();
          break;
        case 'arrowup':
          e.preventDefault();
          updateVolume(volume + 0.1);
          resetControlsTimeout();
          break;
        case 'arrowdown':
          e.preventDefault();
          updateVolume(volume - 0.1);
          resetControlsTimeout();
          break;
        case 't':
          e.preventDefault();
          if (onToggleTheater) onToggleTheater();
          break;
        case '?':
        case '/':
          if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            setShowShortcuts((s) => !s);
          }
          break;
        case 'escape':
          setShowSettingsMenu(false);
          setShowSpeedMenu(false);
          setShowShortcuts(false);
          setShowQueue(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, volume, isMuted, onToggleTheater, resetControlsTimeout]);

  const triggerFeedback = (side, text) => {
    setSeekFeedback({ side, text });
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setSeekFeedback(null), 650);
  };

  const handleTouchStart = () => {
    isTouchInteractionRef.current = true;
    if (touchResetTimeoutRef.current) clearTimeout(touchResetTimeoutRef.current);
    touchResetTimeoutRef.current = setTimeout(() => {
      isTouchInteractionRef.current = false;
    }, 700);
  };

  // Mobile Touch Gestures: Single tap toggles controls, double tap seeks -10s / +10s
  const handleTouchEnd = (e) => {
    // A 2x hold just ended — don't treat the release as a tap.
    if (Date.now() - suppressTapRef.current < 500) {
      suppressTapRef.current = 0;
      return;
    }
    // A vertical swipe gesture just ended — don't treat it as a tap.
    if (Date.now() - swipeEndRef.current < 500) {
      swipeEndRef.current = 0;
      return;
    }
    // Ignore touches on interactive buttons, inputs, menus, and scrubber
    if (e.target && e.target.closest && e.target.closest('button, input, a, [role="button"], .control-bar, .scrubber-bar, [data-interactive="true"]')) {
      return;
    }

    const now = Date.now();
    const touch = e.changedTouches[0];
    if (!touch || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const ratio = x / rect.width;
    const timeDiff = now - lastTapRef.current.time;

    if (timeDiff < 320) {
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);

      if (ratio < 0.35) {
        const video = videoRef.current;
        if (video) {
          const cur = pendingSeekTargetRef.current !== null ? pendingSeekTargetRef.current : video.currentTime;
          const targetTime = Math.max(0, cur - 10);
          requestSeek(targetTime, false);
        }
        triggerFeedback('left', '-10s');
      } else if (ratio > 0.65) {
        const video = videoRef.current;
        if (video) {
          const cur = pendingSeekTargetRef.current !== null ? pendingSeekTargetRef.current : video.currentTime;
          const targetTime = Math.min(duration || 99999, cur + 10);
          requestSeek(targetTime, false);
        }
        triggerFeedback('right', '+10s');
      } else {
        toggleFullscreen();
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x };
      singleTapTimeoutRef.current = setTimeout(() => {
        setShowControls((prev) => {
          const next = !prev;
          if (next) resetControlsTimeout();
          return next;
        });
      }, 240);
    }
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    toggleFullscreen();
  };

  // Mobile vertical-swipe gestures (MX Player style): left half = brightness,
  // right half = volume. Native non-passive touchmove so the page doesn't
  // scroll mid-gesture. Taps/double-taps keep working via the React handlers.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const INTERACTIVE_SEL = 'button, input, a, [role="button"], .control-bar, .scrubber-bar, [data-interactive="true"]';
    const isInteractive = (t) => !!(t && t.closest && t.closest(INTERACTIVE_SEL));

    const onTS = (e) => {
      const t = e.changedTouches[0];
      if (!t || isInteractive(e.target)) {
        swipeRef.current = null;
        return;
      }
      const rect = el.getBoundingClientRect();
      swipeRef.current = {
        x0: t.clientX,
        y0: t.clientY,
        side: (t.clientX - rect.left) < rect.width / 2 ? 'left' : 'right',
        active: false,
        startVol: videoRef.current ? videoRef.current.volume : 1,
        startBright: brightnessRef.current,
      };
      // Double-tap-and-hold → 2x speed (YouTube style). Only arms when this
      // touchstart lands inside the double-tap window of the previous tap.
      if (Date.now() - lastTapRef.current.time < 320) {
        const timer = setTimeout(() => {
          const s = swipeRef.current;
          const v = videoRef.current;
          if (s && !s.active && v && !v.paused) {
            hold2xRef.current = { active: true };
            try {
              v.playbackRate = 2;
            } catch {}
            setIs2xHold(true);
            setSwipeUI({ type: 'speed2x', pct: 200 });
            haptic(15);
          }
        }, 260);
        hold2xRef.current = { timer };
      }
    };

    const onTM = (e) => {
      const s = swipeRef.current;
      if (!s) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - s.x0;
      const dy = t.clientY - s.y0;
      if (!s.active) {
        // A 2x hold owns its touch — never let a swipe take over mid-hold.
        if (hold2xRef.current && hold2xRef.current.active) return;
        // Lock in only on a clear vertical swipe; anything else is not ours.
        if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx) * 1.4) {
          s.active = true;
          // A vertical swipe wins over a pending 2x hold — cancel the timer.
          if (hold2xRef.current && hold2xRef.current.timer) {
            clearTimeout(hold2xRef.current.timer);
            hold2xRef.current = null;
          }
        } else if (Math.abs(dx) > 24 || Math.abs(dy) > 24) {
          swipeRef.current = null;
          return;
        } else {
          return;
        }
      }
      e.preventDefault();
      const delta = (s.y0 - t.clientY) / 160; // full swipe height ≈ 100%
      if (s.side === 'right') {
        const nv = Math.max(0, Math.min(1, s.startVol + delta));
        updateVolume(nv);
        setSwipeUI({ type: 'volume', pct: Math.round(nv * 100) });
      } else {
        const nb = Math.max(0.4, Math.min(1.4, s.startBright + delta));
        applyBrightness(nb);
        setSwipeUI({ type: 'brightness', pct: Math.round(((nb - 0.4) / 1.0) * 100) });
      }
      if (swipeHideTimeoutRef.current) clearTimeout(swipeHideTimeoutRef.current);
    };

    const onTE = () => {
      const s = swipeRef.current;
      if (s && s.active) {
        // Suppress the tap that React's onTouchEnd would otherwise fire.
        swipeEndRef.current = Date.now();
        if (swipeHideTimeoutRef.current) clearTimeout(swipeHideTimeoutRef.current);
        swipeHideTimeoutRef.current = setTimeout(() => setSwipeUI(null), 900);
      }
      // End a 2x hold: restore the chosen rate and swallow the follow-up tap.
      const h = hold2xRef.current;
      if (h) {
        if (h.timer) clearTimeout(h.timer);
        if (h.active) {
          const v = videoRef.current;
          if (v) {
            try {
              v.playbackRate = playbackRateRef.current || 1;
            } catch {}
          }
          setIs2xHold(false);
          setSwipeUI(null);
          suppressTapRef.current = Date.now();
          lastTapRef.current = { time: 0, x: 0 };
          if (swipeHideTimeoutRef.current) clearTimeout(swipeHideTimeoutRef.current);
        }
        hold2xRef.current = null;
      }
      swipeRef.current = null;
    };

    el.addEventListener('touchstart', onTS, { passive: true });
    el.addEventListener('touchmove', onTM, { passive: false });
    el.addEventListener('touchend', onTE, { passive: true });
    el.addEventListener('touchcancel', onTE, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTS);
      el.removeEventListener('touchmove', onTM);
      el.removeEventListener('touchend', onTE);
      el.removeEventListener('touchcancel', onTE);
    };
    // updateVolume/applyBrightness are stable-in-practice (refs + setState only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTimeUpdateInternal = () => {
    const video = videoRef.current;
    if (!video) return;

    const vTime = video.currentTime;

    // Regression guard: if currentTime moves backward by > 5s without a user seek, log warning with stack
    if (!isUserSeekingRef.current && lastKnownGoodTimeRef.current > 5 && vTime < lastKnownGoodTimeRef.current - 5) {
      console.warn(
        `[Player REGRESSION GUARD] Playhead jumped backward by ${(lastKnownGoodTimeRef.current - vTime).toFixed(2)}s without user seek! (from ${lastKnownGoodTimeRef.current.toFixed(2)}s to ${vTime.toFixed(2)}s)\n` +
        (new Error().stack || '')
      );
      // Auto-restore position to preserve viewer progress
      try {
        if (lastKnownGoodTimeRef.current > 0) {
          video.currentTime = lastKnownGoodTimeRef.current;
        }
      } catch {}
    } else if (!isUserSeekingRef.current && vTime >= lastKnownGoodTimeRef.current) {
      lastKnownGoodTimeRef.current = vTime;
      savedPositionRef.current = vTime;
    }

    if (!isDraggingSeekRef.current) {
      setCurrentTime(vTime);
    }
    if (video.duration && !isNaN(video.duration) && video.duration > 0) {
      const nativeDur = video.duration;
      if (canonicalDurationRef.current > 0) {
        if (!durationMismatchWarnedRef.current && Math.abs(nativeDur - canonicalDurationRef.current) > 5) {
          durationMismatchWarnedRef.current = true;
          console.warn(
            `[Player] Duration mismatch: canonical API duration is ${canonicalDurationRef.current}s (${formatDuration(canonicalDurationRef.current)}), but native stream duration is ${nativeDur.toFixed(2)}s (${formatDuration(nativeDur)})`
          );
        }
      } else {
        setDuration(Math.round(nativeDur));
      }
    }

    // Buffer tracking
    if (video.buffered && video.buffered.length > 0) {
      setBufferedEnd(video.buffered.end(video.buffered.length - 1));
    }

    const now = Date.now();
    if (now - lastTimeRef.current > 3000) {
      lastTimeRef.current = now;
      if (onTimeUpdate && (canonicalDurationRef.current > 0 || video.duration)) {
        onTimeUpdate({
          currentTime: vTime,
          duration: canonicalDurationRef.current > 0 ? canonicalDurationRef.current : video.duration,
        });
      }
    }
  };

  const seekToPosition = (clientX, target) => {
    const video = videoRef.current;
    if (!video || !duration || !target) return;
    const rect = target.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    requestSeek(targetTime, true);
  };

  // Desktop mouse dragging scrubber
  const handleScrubberMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isUserSeekingRef.current = true;
    isDraggingSeekRef.current = true;
    resetControlsTimeout();

    const updateSeek = (clientX) => {
      const scrubber = scrubberRef.current;
      if (!scrubber || !duration) return;
      const rect = scrubber.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetTime = pos * duration;
      setCurrentTime(targetTime);
      setHoverPosition(pos * 100);
      setHoverTime(targetTime);
    };

    updateSeek(e.clientX);

    const onMouseMove = (moveEvt) => {
      updateSeek(moveEvt.clientX);
    };

    const onMouseUp = (upEvt) => {
      isDraggingSeekRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const scrubber = scrubberRef.current;
      const video = videoRef.current;
      if (scrubber && video && duration) {
        const rect = scrubber.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (upEvt.clientX - rect.left) / rect.width));
        const targetTime = pos * duration;
        requestSeek(targetTime, true);
      }
      resetControlsTimeout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleSeekClick = (e) => {
    e.stopPropagation();
    seekToPosition(e.clientX, scrubberRef.current || e.currentTarget);
    resetControlsTimeout();
  };

  const handleSeekTouchStart = (e) => {
    e.stopPropagation();
    isUserSeekingRef.current = true;
    isDraggingSeekRef.current = true;
    const touch = e.touches[0];
    const target = scrubberRef.current || e.currentTarget;
    if (!touch || !duration || !target) return;
    const rect = target.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    setCurrentTime(targetTime);
  };

  const handleSeekTouchMove = (e) => {
    e.stopPropagation();
    if (!isDraggingSeekRef.current) return;
    const touch = e.touches[0];
    const target = scrubberRef.current || e.currentTarget;
    if (!touch || !duration || !target) return;
    const rect = target.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    setCurrentTime(targetTime);
  };

  const handleSeekTouchEnd = (e) => {
    e.stopPropagation();
    isDraggingSeekRef.current = false;
    const touch = e.changedTouches[0];
    const target = scrubberRef.current || e.currentTarget;
    const video = videoRef.current;
    if (touch && duration && target && video) {
      const rect = target.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const targetTime = pos * duration;
      requestSeek(targetTime, true);
    }
    resetControlsTimeout();
  };

  const handleSeekMouseMove = (e) => {
    if (!duration) return;
    const target = scrubberRef.current || e.currentTarget;
    const rect = target.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleSeekMouseLeave = () => {
    setHoverTime(null);
  };

  // Seeking event indicator: immediately show buffering/seeking state
  const handleSeeking = () => {
    setIsBuffering(true);
    setIsSeeking(true);
    isSeekingRef.current = true;
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const p = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div className="relative">
      {/* Ambient light glow — sits behind the player, follows video colors */}
      <div
        ref={ambientGlowRef}
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-3 sm:-inset-6 rounded-[2rem] blur-3xl saturate-[1.8] brightness-[1.15] ${
          ambientEnabled
            ? theaterMode || isFullscreen
              ? 'opacity-20'
              : 'opacity-40'
            : 'opacity-0'
        }`}
        style={{
          backgroundColor: ambientColor,
          // Color tracks the video every frame: short transition keeps it
          // responsive at 60fps; opacity keeps a slow fade for toggle/theater.
          transition: 'background-color 120ms linear, opacity 1s ease',
        }}
      />
      {/* Offscreen sampler canvas for ambient light (never visible) */}
      <canvas ref={ambientCanvasRef} width={64} height={36} className="hidden" aria-hidden="true" />
      <div
      ref={containerRef}
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      className={`group/player relative aspect-video bg-black rounded-xl overflow-hidden ring-1 ring-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] select-none outline-none ${
        theaterMode ? 'w-full max-h-[82vh]' : ''
      }`}
    >
      {/* Top Right Quick Controls (hidden in mini-player mode) */}
      {!compact && (
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2 opacity-90 group-hover/player:opacity-100 transition-opacity">
        {sleepTimerRemaining !== null && (
          <button
            type="button"
            onClick={() => setSleepTimerMins(null)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ff9900]/25 border border-[#ff9900]/50 text-[#ff9900] text-[11px] font-bold shadow-lg backdrop-blur-md cursor-pointer hover:bg-[#ff9900]/40 transition-colors min-h-[44px]"
            title="Sleep timer active — click to turn off"
          >
            <IconMoon size={12} className="text-[#ff9900]" />
            <span>{Math.floor(sleepTimerRemaining / 60)}:{String(sleepTimerRemaining % 60).padStart(2, '0')}</span>
          </button>
        )}

        {onToggleTheater && (
          <button
            type="button"
            onClick={onToggleTheater}
            aria-label={theaterMode ? 'Exit Theater Mode' : 'Theater Mode'}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 rounded-lg backdrop-blur-md ring-1 shadow-lg transition-colors cursor-pointer ${
              theaterMode
                ? 'bg-[#ff9900] text-black ring-[#ff9900]'
                : 'bg-black/75 text-neutral-300 ring-white/10 hover:text-white'
            }`}
            title={theaterMode ? 'Exit Theater Mode (T)' : 'Theater Mode (T)'}
          >
            <IconTheater size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowShortcuts((s) => !s)}
          aria-label="Keyboard Shortcuts"
          className="w-11 h-11 rounded-lg bg-black/75 backdrop-blur-md ring-1 ring-white/10 text-neutral-400 hover:text-white text-xs font-bold flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title="Keyboard Shortcuts (?)"
        >
          ?
        </button>
      </div>
      )}

      {/* Sleep Timer Notice Banner */}
      {sleepNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#161616]/95 border border-[#ff9900]/50 px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md animate-bounce">
          <IconMoon size={14} className="text-[#ff9900]" />
          <span>{sleepNotice}</span>
        </div>
      )}

      {/* Player Toast Notice (Cast / quality updates) */}
      {playerToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#161616]/95 border border-[#ff9900]/50 px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md">
          <IconCast size={14} className="text-[#ff9900]" />
          <span>{playerToast}</span>
        </div>
      )}

      {/* Unified High-Performance HTML5 / HLS Player */}
      <video
        ref={videoRef}
        poster={poster || undefined}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        preload="auto"
        onClick={handleVideoClick}
        onPlay={() => {
          if (isMicroNudgingRef.current) return;
          handleSeekedOrPlaying();
          setIsPlaying(true);
        }}
        onPause={() => {
          if (isMicroNudgingRef.current) return;
          setIsPlaying(false);
          if (onPause && videoRef.current) {
            onPause({
              currentTime: videoRef.current.currentTime,
              duration: videoRef.current.duration,
            });
          }
        }}
        onWaiting={() => {
          if (hasStartedPlaybackRef.current) {
            setIsBuffering(true);
            handleAutoRebufferStall();
          }
        }}
        onSeeking={handleSeeking}
        onSeeked={handleSeekedOrPlaying}
        onPlaying={() => {
          handleSeekedOrPlaying();
          setIsPlaying(true);
          hasStartedPlaybackRef.current = true;
          const currentQ = quality === 'auto'
            ? internalStreams[qualityIndex]?.quality
            : quality;
          if (currentQ) {
            lastWorkingQualityRef.current = currentQ;
          }
        }}
        onCanPlay={() => {
          handleSeekedOrPlaying();
          if (videoRef.current && initialTime > 0 && !hasAppliedInitialTimeRef.current) {
            hasAppliedInitialTimeRef.current = true;
            videoRef.current.currentTime = initialTime;
            lastKnownGoodTimeRef.current = initialTime;
            savedPositionRef.current = initialTime;
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current && initialTime > 0 && !hasAppliedInitialTimeRef.current) {
            hasAppliedInitialTimeRef.current = true;
            videoRef.current.currentTime = initialTime;
            lastKnownGoodTimeRef.current = initialTime;
            savedPositionRef.current = initialTime;
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setIsBuffering(false);
          if (onEnded) onEnded();
        }}
        onTimeUpdate={handleTimeUpdateInternal}
        className={`w-full h-full object-contain cursor-pointer relative z-0 transition-opacity duration-150 ${
          (isBuffering || isSeeking) ? 'opacity-40 brightness-75' : 'opacity-100'
        }`}
      />

      {/* Buffering Indicator SVG Spinner Overlay (Shown on stalled/waiting/seeking/quality switch, hidden on play) */}
      {(isBuffering || isSeeking) && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-black/40 backdrop-blur-[1px]">
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-[#ff9900] shadow-2xl ring-1 ring-white/10">
            <IconSpinner size={36} />
          </div>
        </div>
      )}

      {/* Double-tap Seek Feedback Badges */}
      {seekFeedback && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center justify-center ${
            seekFeedback.side === 'left' ? 'left-8' : 'right-8'
          }`}
        >
          <div className="flex flex-col items-center justify-center bg-black/70 backdrop-blur-md text-[#ff9900] px-5 py-3 rounded-2xl ring-1 ring-[#ff9900]/40 shadow-2xl animate-ping-once">
            <span className="text-sm font-black tracking-widest">{seekFeedback.text}</span>
          </div>
        </div>
      )}

      {/* Swipe Gesture Indicator (volume / brightness / 2x hold) */}
      {swipeUI && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none fade-in">
          <div className="flex items-center gap-3 bg-black/80 backdrop-blur-md text-white pl-3 pr-4 py-2.5 rounded-2xl ring-1 ring-[#ff9900]/40 shadow-2xl">
            {swipeUI.type === 'volume' ? (
              <IconVolume size={20} className="text-[#ff9900] shrink-0" />
            ) : swipeUI.type === 'brightness' ? (
              <IconSun size={20} className="text-[#ff9900] shrink-0" />
            ) : (
              <IconSpeed size={20} className="text-[#ff9900] shrink-0" />
            )}
            <div className="w-28">
              <div className="text-[11px] font-bold mb-1">
                {swipeUI.type === 'speed2x' ? (
                  <>2x Speed <span className="text-[#ff9900]">ON</span></>
                ) : (
                  <>{swipeUI.type === 'volume' ? 'Volume' : 'Brightness'} <span className="text-[#ff9900]">{swipeUI.pct}%</span></>
                )}
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff9900] rounded-full transition-[width] duration-75"
                  style={{ width: `${swipeUI.type === 'speed2x' ? 100 : Math.min(100, swipeUI.pct)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Center Play Button Overlay when paused */}
      {!isPlaying && !hasError && !isBuffering && !isSeeking && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
            resetControlsTimeout();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            togglePlay();
            resetControlsTimeout();
          }}
          data-interactive="true"
          style={{ touchAction: 'manipulation' }}
          className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer group-hover/player:bg-black/20 transition-all z-20"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#ff9900] hover:bg-[#ffa726] active:scale-95 flex items-center justify-center text-black shadow-2xl shadow-[#ff9900]/30 transform group-hover/player:scale-110 transition-all pl-1 cursor-pointer ring-4 ring-black/40">
            <IconPlay size={40} className="sm:w-11 sm:h-11" />
          </div>
        </div>
      )}

      {compact ? (
        /* Compact mini-player control bar */
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-2 pt-7 pb-2 flex items-center gap-1 z-30">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 text-white transition-colors cursor-pointer touch-manipulation"
          >
            {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 text-white transition-colors cursor-pointer touch-manipulation"
          >
            {isMuted || volume === 0 ? <IconVolumeMute size={18} /> : <IconVolume size={18} />}
          </button>
          <div className="min-w-0 flex-1 px-1">
            <p className="text-[11px] font-semibold text-white truncate leading-tight">{title}</p>
            <p className="text-[10px] text-[#ff9900] font-bold leading-tight">Mini player • tap ↑ to expand</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (onExpand) onExpand(); }}
            aria-label="Back to player"
            title="Back to player"
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 text-[#ff9900] transition-colors cursor-pointer touch-manipulation"
          >
            <IconArrowUp size={20} />
          </button>
        </div>
      ) : (
      <>
      {/* Bottom Floating Control Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/85 to-transparent px-3 sm:px-4 pt-8 pb-safe flex flex-col gap-2 transition-all duration-300 z-30 ${
          showControls || !isPlaying || showSettingsMenu || showSpeedMenu
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-2 pointer-events-none group-hover/player:opacity-100 group-hover/player:translate-y-0 group-hover/player:pointer-events-auto'
        }`}
      >
        {/* Scrubber Progress Bar */}
        <div
          ref={scrubberRef}
          onMouseDown={handleScrubberMouseDown}
          onClick={handleSeekClick}
          onTouchStart={handleSeekTouchStart}
          onTouchMove={handleSeekTouchMove}
          onTouchEnd={handleSeekTouchEnd}
          onMouseMove={handleSeekMouseMove}
          onMouseLeave={handleSeekMouseLeave}
          className="scrubber-bar relative w-full h-8 flex items-center cursor-pointer group/bar transition-all overflow-visible select-none py-2 pointer-events-auto"
        >
          {/* Visual Track */}
          <div className="relative w-full h-1.5 group-hover/bar:h-2.5 bg-neutral-800/90 rounded-full transition-all overflow-hidden">
            {/* Buffer Bar */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-white/25 rounded-full transition-all"
              style={{ width: `${Math.min(100, bufferPercent)}%` }}
            />
            {/* Progress Bar */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-[#ff9900] rounded-full shadow-[0_0_12px_#ff9900]"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>

          {/* Thumb handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white ring-2 ring-[#ff9900] shadow-md opacity-100 sm:opacity-0 sm:group-hover/bar:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${Math.min(100, progressPercent)}%` }}
          />

          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 bg-black/90 text-white text-[11px] font-mono px-2 py-0.5 rounded shadow pointer-events-none ring-1 ring-white/10"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="control-bar flex items-center justify-between gap-2 text-white text-sm select-none pointer-events-auto">
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* Play / Pause Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                haptic();
                togglePlay();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 hover:text-[#ff9900] transition-colors cursor-pointer touch-manipulation pointer-events-auto"
              title={isPlaying ? 'Pause (Space/K)' : 'Play (Space/K)'}
            >
              {isPlaying ? <IconPause size={22} /> : <IconPlay size={22} />}
            </button>

            {/* Volume & Mute */}
            <div
              className="flex items-center gap-1.5 group/vol"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  haptic();
                  toggleMute();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 hover:text-[#ff9900] transition-colors cursor-pointer touch-manipulation pointer-events-auto"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <IconVolumeMute size={20} />
                ) : volume > 0.5 ? (
                  <IconVolume size={20} />
                ) : (
                  <IconVolumeLow size={20} />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                aria-label="Volume slider"
                value={isMuted ? 0 : volume}
                onChange={(e) => updateVolume(parseFloat(e.target.value))}
                className="hidden sm:block w-16 h-1 accent-[#ff9900] bg-neutral-700 rounded cursor-pointer pointer-events-auto"
              />
            </div>

            {/* Time Display */}
            <span className="text-[11px] sm:text-xs font-mono text-neutral-300 shrink-0">
              {formatTime(currentTime)} / {formatDuration(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2.5">
            {/* Loop Single Video Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleLoop();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={loop ? 'Disable loop' : 'Loop this video'}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer touch-manipulation pointer-events-auto ${
                loop ? 'text-[#ff9900]' : 'text-white hover:text-[#ff9900]'
              }`}
              title={loop ? 'Loop ON — video repeats' : 'Loop this video'}
            >
              <IconRefresh size={18} />
            </button>

            {/* Up-Next Queue Button */}
            <div className="relative queue-panel-container">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  haptic();
                  setShowQueue((s) => !s);
                  setShowSpeedMenu(false);
                  setShowSettingsMenu(false);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={showQueue ? 'Close queue' : 'Open up-next queue'}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer touch-manipulation pointer-events-auto ${
                  showQueue ? 'text-[#ff9900] bg-white/10' : 'text-white hover:text-[#ff9900]'
                }`}
                title="Up-next queue"
              >
                <IconList size={18} />
              </button>
              {queue.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#ff9900] text-black text-[10px] font-black flex items-center justify-center pointer-events-none">
                  {queue.length > 99 ? '99+' : queue.length}
                </span>
              )}
            </div>

            {/* Playback Speed Menu */}
            <div className="relative speed-menu-container z-40 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpeedMenu((prev) => !prev);
                  setShowSettingsMenu(false);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Playback speed"
                className="min-h-[44px] min-w-[44px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white hover:text-[#ff9900] text-[11px] sm:text-xs font-bold transition-colors cursor-pointer touch-manipulation pointer-events-auto"
                title="Playback Speed"
              >
                <IconSpeed size={14} />
                <span>{playbackRate}x</span>
              </button>

              {showSpeedMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-12 z-50 bg-[#141414] border border-[#2a2a2a] rounded-2xl p-1.5 shadow-2xl min-w-[120px] flex flex-col gap-1 backdrop-blur-md pointer-events-auto"
                >
                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-neutral-500 border-b border-[#222]">
                    Speed
                  </div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => updatePlaybackRate(rate)}
                      className={`w-full text-left min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between touch-manipulation cursor-pointer pointer-events-auto ${
                        playbackRate === rate
                          ? 'bg-[#ff9900] text-black font-bold'
                          : 'text-neutral-300 hover:text-white hover:bg-[#222]'
                      }`}
                    >
                      <span>{rate}x</span>
                      {playbackRate === rate && <IconCheck size={14} className="text-black stroke-[3]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Menu with >= 44px Touch Target */}
            <div className="relative settings-menu-container z-40 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsMenu((prev) => !prev);
                  setShowSpeedMenu(false);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Video quality settings"
                className="min-h-[44px] min-w-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white hover:text-[#ff9900] text-xs font-bold transition-colors cursor-pointer touch-manipulation pointer-events-auto"
                title="Quality Settings"
              >
                <IconSettings size={15} />
                <span className="capitalize hidden sm:inline">{activeQualityLabel}</span>
              </button>

              {showSettingsMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-12 z-50 bg-[#141414] border border-[#2a2a2a] rounded-2xl p-1.5 shadow-2xl min-w-[145px] flex flex-col gap-1 backdrop-blur-md pointer-events-auto"
                >
                  <button
                    type="button"
                    onClick={toggleAutoplaySetting}
                    aria-label="Toggle Autoplay Next"
                    className="w-full flex items-center justify-between px-3 py-2 border-b border-[#222] cursor-pointer min-h-[44px]"
                  >
                    <span className="text-xs font-semibold text-neutral-300">Autoplay</span>
                    <span
                      aria-hidden="true"
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 flex items-center ${
                        isAutoplay ? 'bg-[#ff9900]' : 'bg-[#333]'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          isAutoplay ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleAmbient}
                    aria-label="Toggle Ambient Light"
                    className="w-full flex items-center justify-between px-3 py-2 border-b border-[#222] cursor-pointer min-h-[44px]"
                  >
                    <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                      <IconSparkles size={12} className="text-[#ff9900]" /> Ambient Light
                    </span>
                    <span
                      aria-hidden="true"
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 flex items-center ${
                        ambientEnabled ? 'bg-[#ff9900]' : 'bg-[#333]'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          ambientEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-neutral-500 border-b border-[#222]">
                    Quality
                  </div>
                  <button
                    type="button"
                    onClick={() => updateQuality('auto')}
                    className={`w-full text-left min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between touch-manipulation cursor-pointer pointer-events-auto ${
                      quality === 'auto'
                        ? 'bg-[#ff9900] text-black font-bold'
                        : 'text-neutral-300 hover:text-white hover:bg-[#222]'
                    }`}
                  >
                    <span>Auto</span>
                    {quality === 'auto' && <IconCheck size={14} className="text-black stroke-[3]" />}
                  </button>
                  {qualities.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => updateQuality(q)}
                      className={`w-full text-left min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between touch-manipulation cursor-pointer pointer-events-auto ${
                        quality === q
                          ? 'bg-[#ff9900] text-black font-bold'
                          : 'text-neutral-300 hover:text-white hover:bg-[#222]'
                      }`}
                    >
                      <span>{q}p</span>
                      {quality === q && <IconCheck size={14} className="text-black stroke-[3]" />}
                    </button>
                  ))}

                  {/* Sleep Timer Selector */}
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-neutral-500 border-t border-b border-[#222] flex items-center justify-between mt-1">
                    <span className="flex items-center gap-1.5">
                      <IconMoon size={11} className="text-[#ff9900]" /> Sleep Timer
                    </span>
                    {sleepTimerRemaining !== null && (
                      <span className="text-[#ff9900] font-mono text-[10px]">
                        {Math.floor(sleepTimerRemaining / 60)}:{String(sleepTimerRemaining % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#1a1a1a] rounded-xl my-0.5">
                    {[
                      { label: 'Off', val: null },
                      { label: '15m', val: 15 },
                      { label: '30m', val: 30 },
                      { label: '60m', val: 60 },
                    ].map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => setSleepTimerMins(t.val)}
                        className={`py-1 min-h-[44px] flex items-center justify-center text-center rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          sleepTimerMins === t.val
                            ? 'bg-[#ff9900] text-black font-extrabold'
                            : 'text-neutral-400 hover:text-white hover:bg-[#252525]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Theater Mode Button */}
            {onToggleTheater && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTheater();
                }}
                aria-label={theaterMode ? 'Exit Theater Mode' : 'Theater Mode'}
                className="min-w-[44px] min-h-[44px] items-center justify-center p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 hover:text-[#ff9900] transition-colors cursor-pointer hidden sm:flex touch-manipulation"
                title={theaterMode ? 'Exit Theater Mode (T)' : 'Theater Mode (T)'}
              >
                <IconTheater size={18} className={theaterMode ? 'text-[#ff9900]' : ''} />
              </button>
            )}

            {/* Picture in Picture Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePiP();
              }}
              aria-label="Picture in Picture"
              className="min-w-[44px] min-h-[44px] items-center justify-center p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 hover:text-[#ff9900] transition-colors cursor-pointer hidden sm:flex touch-manipulation"
              title="Picture in Picture"
            >
              <IconPip size={18} />
            </button>

            {/* Google Cast Button */}
            {canCast && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCast();
                }}
                aria-label={isCasting ? 'Connected to Cast device' : 'Cast to TV / Device'}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer touch-manipulation ${
                  isCasting ? 'text-[#ff9900] bg-[#ff9900]/15 ring-1 ring-[#ff9900]/40' : 'text-neutral-200 hover:text-[#ff9900]'
                }`}
                title={isCasting ? 'Casting to TV (Connected)' : 'Cast Video to TV'}
              >
                <IconCast size={18} />
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                haptic();
                toggleFullscreen();
              }}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 hover:text-[#ff9900] transition-colors cursor-pointer touch-manipulation"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <IconFullscreenExit size={20} /> : <IconFullscreen size={20} />}
            </button>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Reconnection / Error Overlay with Retry from last working quality */}
      {hasError && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center backdrop-blur-sm">
          <div className="w-14 h-14 rounded-full bg-[#ff9900]/15 flex items-center justify-center text-[#ff9900] ring-1 ring-[#ff9900]/30 animate-pulse">
            <IconAlert size={32} />
          </div>
          <div className="max-w-md">
            <h4 className="text-base font-bold text-white mb-1">Playback Notice</h4>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {errorMsg || 'Connection to video stream was interrupted. Click Retry to reconnect.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRetry}
              aria-label="Retry Playback"
              className="px-6 py-2.5 rounded-xl bg-[#ff9900] text-black font-bold text-sm hover:bg-[#e68a00] transition-colors shadow-lg shadow-[#ff9900]/20 flex items-center gap-2 cursor-pointer touch-manipulation active:scale-95"
            >
              <IconPlay size={16} />
              <span>Retry Playback</span>
            </button>
          </div>
        </div>
      )}

      {/* Up-Next Queue Panel */}
      {showQueue && (
        <div
          className="queue-panel-container absolute right-3 bottom-24 z-50 w-[min(340px,86vw)] max-h-[52%] flex flex-col bg-[#141414]/97 backdrop-blur-md border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden fade-in"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          data-interactive="true"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#222] shrink-0">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <IconList size={16} className="text-[#ff9900]" />
              Up Next
              {queue.length > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#ff9900]/20 text-[#ff9900]">
                  {queue.length}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearQueue();
                    haptic();
                  }}
                  className="min-h-[44px] px-3 text-xs font-bold text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowQueue(false)}
                aria-label="Close queue"
                className="w-11 h-11 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto overscroll-contain">
            {queue.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-neutral-500 leading-relaxed">
                Queue is empty.
                <br />
                Add videos from any video page to play them back-to-back.
              </p>
            ) : (
              queue.map((q) => (
                <div
                  key={q.vkey}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-[#1c1c1c] transition-colors cursor-pointer group/row"
                  onClick={() => playQueueItem(q.vkey)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') playQueueItem(q.vkey);
                  }}
                >
                  <div className="relative w-24 shrink-0 aspect-video rounded-lg overflow-hidden bg-black">
                    {q.thumbnail && (
                      <img src={q.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <IconPlay size={20} className="text-white" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="clamp-2 text-xs font-medium text-neutral-100 leading-snug">{q.title}</p>
                    {q.duration && (
                      <p className="text-[10px] text-neutral-500 mt-1">{q.duration}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(q.vkey);
                      haptic();
                    }}
                    aria-label="Remove from queue"
                    className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <IconX size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          onClick={() => setShowShortcuts(false)}
          className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 max-w-sm w-full shadow-2xl text-left cursor-default"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#222]">
              <h3 className="font-bold text-white text-base">Keyboard Shortcuts</h3>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
                className="text-neutral-400 hover:text-white text-sm cursor-pointer p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="space-y-2 text-xs text-neutral-300">
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Play / Pause</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">Space / K</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Seek -10s / +10s</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">J / L</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Double-tap left / right edge</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">Seek −10s / +10s</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Double-tap &amp; hold</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">2x speed</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Rotate phone to landscape</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">Auto fullscreen</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Loop button (control bar)</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">Repeat video</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Swipe up / down (left half)</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">Brightness</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Swipe up / down (right half)</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">Volume</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Seek -5s / +5s</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">Left / Right</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Volume Up / Down</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">Up / Down</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Fullscreen</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">F</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Mute / Unmute</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">M</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1c1c1c]">
                <span>Theater Mode</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">T</kbd>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Shortcuts Overlay</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] font-mono text-[#ff9900]">? (Shift+/)</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
