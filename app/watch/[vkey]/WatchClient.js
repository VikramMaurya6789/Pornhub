'use client';
import { useEffect, useState, useRef, Suspense, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Player from '../../../components/Player';
import VideoCard, { VideoGridSkeleton } from '../../../components/VideoCard';
import { getUserId } from '../../../lib/uid';
import { hasRejectedFunctional, openCookiePreferences } from '../../../lib/consent';
import {
  IconThumbUp, IconThumbDown, IconShare, IconEye, IconClock,
  IconTag, IconUser, IconBadgeCheck, IconChevronR, IconBookmark, IconCheck,
  IconBell, IconMessage, IconSend, IconFlag, IconSparkles, IconTheater,
  IconPlayNext, IconSpeed, IconHeart, IconAlert, IconStar, IconList, IconPlus, IconX, IconSpinner,
  IconWhatsApp, IconTelegram, IconQr, IconDownload
} from '../../../components/Icons';
import { generateQrSvg } from '../../../lib/qr';
import { getQueue, addToQueue, shiftQueue } from '../../../lib/queue';
import {
  isWatchLater,
  toggleWatchLater as toggleWatchLaterLib,
  WATCHLATER_CHANGED_EVENT,
} from '../../../lib/watchlater';
import { haptic } from '../../../lib/haptics';
import { formatCount, formatViews, formatMaxViews } from '../../../lib/format';

function WatchContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vkey = params?.vkey;

  // Always start at top when opening a video (Next.js preserves scroll otherwise)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [vkey]);
  // Resume: explicit ?t= param wins; otherwise restore saved position from history
  // (only when meaningfully into the video but not nearly finished).
  const { initialTime, resumedFrom } = useMemo(() => {
    const tParam = Math.max(0, parseFloat(searchParams?.get('t') || '0'));
    if (tParam > 0) return { initialTime: tParam, resumedFrom: 0 };
    if (!vkey || hasRejectedFunctional()) return { initialTime: 0, resumedFrom: 0 };
    try {
      const raw = localStorage.getItem('oh_history');
      const list = raw ? JSON.parse(raw) : [];
      const item = list.find((h) => h && h.vkey === vkey);
      const ct = Math.round(item?.currentTime || 0);
      const total = Math.round(item?.totalDuration || item?.durationSec || 0);
      if (ct > 10 && total > 30) {
        const pct = ct / total;
        if (pct >= 0.02 && pct <= 0.95) return { initialTime: ct, resumedFrom: ct };
      }
    } catch {}
    return { initialTime: 0, resumedFrom: 0 };
  }, [vkey]);
  const [v, setV] = useState(null);
  const [err, setErr] = useState(null);
  const [vote, setVote] = useState(null);
  const [saved, setSaved] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subCount, setSubCount] = useState('');
  const [copied, setCopied] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [playbackTime, setPlaybackTime] = useState(0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrWithTimestamp, setQrWithTimestamp] = useState(false);

  // Theater Mode & Autoplay state
  const [theaterMode, setTheaterMode] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [nextCountdown, setNextCountdown] = useState(null);

  // Floating Miniplayer scroll state
  const [isScrolledPast, setIsScrolledPast] = useState(false);
  const playerAnchorRef = useRef(null);
  // True floating mini-player: the real player detaches and floats bottom-right
  // once scrolled past (same video element keeps playing — no remount).
  const miniPlayerActive = isScrolledPast && !!v && !theaterMode;

  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentLikes, setCommentLikes] = useState({});

  // View Counter state
  const [liveViews, setLiveViews] = useState(null);

  // Playlist state
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [savedPlaylistIds, setSavedPlaylistIds] = useState(new Set());
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // Report state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('broken_video');
  const [reportDetails, setReportDetails] = useState('');

  // Download state
  const [showDownloadSheet, setShowDownloadSheet] = useState(false);
  const [downloadQualities, setDownloadQualities] = useState([]);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const openDownloadSheet = async () => {
    setShowDownloadSheet(true);
    setDownloadLoading(true);
    setDownloadQualities([]);
    try {
      const r = await fetch(`/api/download?vkey=${encodeURIComponent(vkey)}`);
      const j = await r.json();
      if (r.ok && Array.isArray(j.downloads)) {
        setDownloadQualities(j.downloads);
      }
    } catch {}
    setDownloadLoading(false);
  };
  const [submittingReport, setSubmittingReport] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Notify once per video when resuming from a saved position
  useEffect(() => {
    if (resumedFrom > 0) {
      const m = Math.floor(resumedFrom / 60);
      const s = String(Math.floor(resumedFrom % 60)).padStart(2, '0');
      const t = setTimeout(() => showToast(`Resumed from ${m}:${s}`), 1200);
      return () => clearTimeout(t);
    }
  }, [vkey]);

  const openPlaylistModal = async () => {
    if (hasRejectedFunctional()) {
      openCookiePreferences();
      return;
    }
    setShowPlaylistModal(true);
    setLoadingPlaylists(true);
    const uid = getUserId();
    if (!uid) {
      setLoadingPlaylists(false);
      return;
    }
    try {
      const res = await fetch(`/api/playlists?uid=${encodeURIComponent(uid)}`);
      const data = await res.json();
      if (Array.isArray(data?.playlists)) {
        setUserPlaylists(data.playlists);
        const inSet = new Set();
        data.playlists.forEach((pl) => {
          if (pl.items && pl.items.some((it) => it.vkey === vkey)) {
            inSet.add(pl.id);
          }
        });
        setSavedPlaylistIds(inSet);
      }
    } catch {
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const togglePlaylistMembership = async (pl) => {
    if (hasRejectedFunctional()) {
      openCookiePreferences();
      return;
    }
    const inPlaylist = savedPlaylistIds.has(pl.id);
    const nextSet = new Set(savedPlaylistIds);

    if (inPlaylist) {
      nextSet.delete(pl.id);
      setSavedPlaylistIds(nextSet);
      try {
        await fetch(`/api/playlists/${pl.id}/items`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vkey }),
        });
        showToast(`Removed from "${pl.name}"`);
      } catch {}
    } else {
      nextSet.add(pl.id);
      setSavedPlaylistIds(nextSet);
      try {
        await fetch(`/api/playlists/${pl.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vkey,
            title: v?.title || 'OrangeHub Video',
            thumbnail: v?.thumbnail || '',
          }),
        });
        showToast(`Saved to "${pl.name}"`);
      } catch {}
    }
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (hasRejectedFunctional()) {
      openCookiePreferences();
      return;
    }
    const name = newPlaylistName.trim();
    if (!name) return;
    const uid = getUserId();
    if (!uid) return;

    setCreatingPlaylist(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, name, isPublic: true }),
      });
      const data = await res.json();
      if (data?.playlist) {
        await fetch(`/api/playlists/${data.playlist.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vkey,
            title: v?.title || 'OrangeHub Video',
            thumbnail: v?.thumbnail || '',
          }),
        });

        const newPl = {
          ...data.playlist,
          items: [{ vkey, title: v?.title, thumbnail: v?.thumbnail }],
        };
        setUserPlaylists((prev) => [newPl, ...prev]);
        setSavedPlaylistIds((prev) => new Set([...prev, newPl.id]));
        setNewPlaylistName('');
        showToast(`Created "${name}" and added video!`);
      }
    } catch {
      showToast('Failed to create playlist');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReport(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vkey,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        showToast('Thank you! Your report has been submitted.');
        setShowReportModal(false);
        setReportDetails('');
        setReportReason('broken_video');
      } else {
        showToast(data?.error || 'Failed to submit report');
      }
    } catch {
      showToast('Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  useEffect(() => {
    if (!vkey) return;
    // New video: clear stale data immediately + guard against out-of-order fetches
    setV(null);
    setErr(null);
    setComments([]);
    let cancelled = false;
    try {
      setVote(localStorage.getItem(`oh_vote_${vkey}`));
      setSaved(!hasRejectedFunctional() && localStorage.getItem(`oh_saved_${vkey}`) === '1');
      setTheaterMode(localStorage.getItem('oh_theater') === '1');
      const storedAutoplay = localStorage.getItem('oh_autoplay');
      setAutoplayNext(storedAutoplay === null ? true : storedAutoplay === '1');
    } catch {}

    // Deduplicated session view counter increment (POST /api/view with sessionStorage guard)
    try {
      const sessionKey = `oh_viewed_${vkey}`;
      let viewedInSession = false;
      try {
        viewedInSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey) === '1';
      } catch {}

      if (!viewedInSession) {
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(sessionKey, '1');
          }
        } catch {}

        fetch('/api/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vkey }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data && typeof data.views === 'number') {
              setLiveViews(data.views);
            }
          })
          .catch(() => {});
      } else {
        fetch(`/api/view?vkey=${encodeURIComponent(vkey)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data && typeof data.views === 'number') {
              setLiveViews(data.views);
            }
          })
          .catch(() => {});
      }
    } catch {}

    // Sync favorite state with Postgres DB
    try {
      const currentUid = getUserId();
      if (currentUid && !hasRejectedFunctional()) {
        fetch(`/api/favorites?uid=${encodeURIComponent(currentUid)}`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data?.favorites) && data.favorites.some((f) => f.vkey === vkey)) {
              setSaved(true);
              try { localStorage.setItem(`oh_saved_${vkey}`, '1'); } catch {}
            }
          })
          .catch(() => {});
      }
    } catch {}

    (async () => {
      try {
        // Use prefetched data if available (from VideoCard tap/hover)
        let j = null;
        try {
          const key = `oh_prefetch_${vkey}_data`;
          const cached = sessionStorage.getItem(key);
          if (cached) {
            j = JSON.parse(cached);
            sessionStorage.removeItem(key);
            sessionStorage.removeItem(`oh_prefetch_${vkey}`);
          }
        } catch {}
        if (!j || j.error) {
          let r = await fetch(`/api/video?vkey=${vkey}`);
          if (!r.ok) {
            r = await fetch(`/api/video?vkey=${vkey}&refresh=1`);
          }
          j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Failed to load video');
        }
        if (cancelled) return;
        setV(j);

        // Check author subscription
        if (j.author) {
          try {
            setSubscribed(localStorage.getItem(`oh_sub_${j.author}`) === '1');
          } catch {}
          setSubCount(j.authorSubscribers || '120K Subscribers');
        }

        // Initialize comments (Server comments + API comments + local user comments)
        let localComments = [];
        try {
          const stored = localStorage.getItem(`oh_comments_${vkey}`);
          if (stored) localComments = JSON.parse(stored);
        } catch {}

        let serverComments = [];
        try {
          const cRes = await fetch(`/api/comments?vkey=${encodeURIComponent(vkey)}`);
          if (cRes.ok) {
            const cData = await cRes.json();
            if (Array.isArray(cData?.comments)) {
              serverComments = cData.comments;
            }
          }
        } catch {}

        const rawComments = [...serverComments, ...localComments, ...(j.comments || [])];
        const seenKeys = new Set();
        const allComments = rawComments.filter((c) => {
          if (!c || !c.message) return false;
          const msg = String(c.message).trim();
          if (!msg || msg.includes('[[') || msg.includes(']]')) return false;
          const key = c.id || msg;
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });
        if (cancelled) return;
        setComments(allComments.map((c, i) => ({
          ...c,
          user: c?.user || 'User_' + (i + 1),
        })));
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();

    return () => { cancelled = true; };
  }, [vkey]);

  // Track scroll position to trigger mini-player notification
  useEffect(() => {
    const handleScroll = () => {
      if (!playerAnchorRef.current) return;
      const rect = playerAnchorRef.current.getBoundingClientRect();
      setIsScrolledPast(rect.bottom < 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Autoplay countdown timer
  const [nextUpOverride, setNextUpOverride] = useState(null); // queued video takes precedence
  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) {
      const target = nextUpOverride?.vkey || v?.related?.[0]?.vkey;
      if (target) {
        if (nextUpOverride) {
          try {
            shiftQueue();
          } catch {}
        }
        router.push(`/watch/${target}`);
      }
      return;
    }
    const t = setTimeout(() => {
      setNextCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => clearTimeout(t);
  }, [nextCountdown, v, router, nextUpOverride]);

  // If this video was the head of the Up-Next queue, consume it on load.
  useEffect(() => {
    try {
      const q = getQueue();
      if (q.length > 0 && q[0].vkey === vkey) shiftQueue();
    } catch {}
  }, [vkey]);

  // Sync saved status on consent change
  useEffect(() => {
    const handleConsent = () => {
      if (hasRejectedFunctional()) {
        setSaved(false);
      } else {
        try {
          setSaved(localStorage.getItem(`oh_saved_${vkey}`) === '1');
        } catch {}
      }
    };
    window.addEventListener('oh_consent_changed', handleConsent);
    return () => window.removeEventListener('oh_consent_changed', handleConsent);
  }, [vkey]);

  const lastHistorySavedRef = useRef(0);

  const postHistoryProgress = (currentTime, duration) => {
    if (!v || !vkey || hasRejectedFunctional()) return;
    const uid = getUserId();
    if (!uid) return;
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        vkey,
        title: v.title,
        thumbnail: v.thumbnail,
        durationSec: Math.round(duration || 0),
        progressSec: Math.round(currentTime || 0),
      }),
    }).catch(() => {});
  };

  const handleEnded = () => {
    postHistoryProgress(v?.durationSec || 0, v?.durationSec || 0);
    // Up-Next queue takes precedence over autoplay's related pick.
    try {
      const q = getQueue();
      if (q.length > 0) {
        setNextUpOverride({
          vkey: q[0].vkey,
          title: q[0].title,
          thumbnail: q[0].thumbnail,
          duration: q[0].duration,
        });
        setNextCountdown(5);
        return;
      }
    } catch {}
    if (!autoplayNext || !v?.related?.length) return;
    const nextVideo = v.related[0];
    if (nextVideo?.vkey) {
      setNextUpOverride(null);
      setNextCountdown(5);
    }
  };

  const handlePause = (data) => {
    if (data && typeof data.currentTime === 'number') {
      postHistoryProgress(data.currentTime, data.duration);
    }
  };

  const handleTimeUpdate = ({ currentTime, duration }) => {
    setPlaybackTime(currentTime);
    if (!v || !vkey || !duration || hasRejectedFunctional()) return;
    try {
      const raw = localStorage.getItem('oh_history');
      const list = raw ? JSON.parse(raw) : [];
      const filtered = list.filter((item) => item.vkey !== vkey);
      filtered.unshift({
        vkey,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.duration,
        currentTime: Math.round(currentTime),
        totalDuration: Math.round(duration),
        progress: Math.min(100, Math.round((currentTime / duration) * 100)),
        timestamp: Date.now(),
        author: v.author,
      });
      localStorage.setItem('oh_history', JSON.stringify(filtered.slice(0, 30)));
    } catch {}

    const now = Date.now();
    if (now - lastHistorySavedRef.current >= 10000) {
      lastHistorySavedRef.current = now;
      postHistoryProgress(currentTime, duration);
    }
  };

  const toggleTheater = () => {
    const next = !theaterMode;
    setTheaterMode(next);
    try {
      localStorage.setItem('oh_theater', next ? '1' : '0');
    } catch {}
  };

  const toggleAutoplay = () => {
    const next = !autoplayNext;
    setAutoplayNext(next);
    try {
      localStorage.setItem('oh_autoplay', next ? '1' : '0');
    } catch {}
    showToast(next ? 'Autoplay Next enabled' : 'Autoplay Next disabled');
  };

  const doVote = (val) => {
    const next = vote === val ? null : val;
    setVote(next);
    try {
      if (next) localStorage.setItem(`oh_vote_${vkey}`, next);
      else localStorage.removeItem(`oh_vote_${vkey}`);
    } catch {}
    if (next === 'up') showToast('Added to your liked videos');
  };

  const toggleSave = () => {
    if (!v) return;
    if (hasRejectedFunctional()) {
      openCookiePreferences();
      return;
    }
    const next = !saved;
    setSaved(next);
    const uid = getUserId();

    try {
      if (next) localStorage.setItem(`oh_saved_${vkey}`, '1');
      else localStorage.removeItem(`oh_saved_${vkey}`);

      const raw = localStorage.getItem('oh_favorites_list');
      const list = raw ? JSON.parse(raw) : [];
      if (next) {
        if (!list.some((item) => item.vkey === vkey)) {
          list.unshift({
            vkey,
            title: v.title,
            thumbnail: v.thumbnail,
            duration: v.duration,
            views: v.views,
            author: v.author,
            added: Date.now(),
          });
        }
      } else {
        const idx = list.findIndex((item) => item.vkey === vkey);
        if (idx !== -1) list.splice(idx, 1);
      }
      localStorage.setItem('oh_favorites_list', JSON.stringify(list));
    } catch {}

    if (uid) {
      if (next) {
        fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid,
            vkey,
            title: v.title,
            thumbnail: v.thumbnail,
          }),
        }).catch(() => {});
      } else {
        fetch(`/api/favorites?uid=${encodeURIComponent(uid)}&vkey=${encodeURIComponent(vkey)}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
    }

    showToast(next ? 'Saved to Favorites!' : 'Removed from Favorites');
  };

  // Watch Later (one-tap save, local list)
  const [watchLater, setWatchLater] = useState(false);
  useEffect(() => {
    const sync = () => {
      try {
        setWatchLater(isWatchLater(vkey));
      } catch {
        setWatchLater(false);
      }
    };
    sync();
    window.addEventListener(WATCHLATER_CHANGED_EVENT, sync);
    return () => window.removeEventListener(WATCHLATER_CHANGED_EVENT, sync);
  }, [vkey]);

  const toggleWatchLater = () => {
    if (!v) return;
    const next = toggleWatchLaterLib({
      vkey,
      title: v.title,
      thumbnail: v.thumbnail,
      duration: v.duration,
      views: v.views,
      author: v.author,
    });
    if (next === null) {
      openCookiePreferences();
      return;
    }
    setWatchLater(next);
    haptic();
    showToast(next ? 'Saved to Watch Later' : 'Removed from Watch Later');
  };

  const addCurrentToQueue = () => {
    if (!v) return;
    const added = addToQueue({
      vkey,
      title: v.title,
      thumbnail: v.thumbnail,
      duration: v.duration,
      views: v.views,
      author: v.author,
    });
    haptic();
    showToast(added ? 'Added to queue — plays next' : 'Already in queue');
  };

  const toggleSubscribe = () => {
    if (!v?.author) return;
    const next = !subscribed;
    setSubscribed(next);
    try {
      if (next) localStorage.setItem(`oh_sub_${v.author}`, '1');
      else localStorage.removeItem(`oh_sub_${v.author}`);
    } catch {}
    showToast(next ? `Subscribed to ${v.author}!` : `Unsubscribed from ${v.author}`);
  };

  const getShareUrl = (withTimestamp = false) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://orangehub.royalcloud.qzz.io';
    let url = `${origin}/watch/${vkey}`;
    if (withTimestamp && playbackTime > 0) {
      url += `?t=${Math.round(playbackTime)}`;
    }
    return url;
  };

  const copyShare = async (withTimestamp = false) => {
    const url = getShareUrl(withTimestamp);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShowShareMenu(false);
      showToast(withTimestamp ? `Copied link with timestamp (${Math.round(playbackTime)}s)!` : 'Video link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copy this link:', url);
    }
  };

  const shareWhatsApp = (withTimestamp = false) => {
    const url = getShareUrl(withTimestamp);
    const titleText = v?.title ? `Watch "${v.title}" on OrangeHub:\n` : 'Watch full length video on OrangeHub:\n';
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(titleText + url)}`, '_blank');
    setShowShareMenu(false);
  };

  const shareTelegram = (withTimestamp = false) => {
    const url = getShareUrl(withTimestamp);
    const titleText = v?.title ? `Watch "${v.title}" on OrangeHub` : 'Watch full length video on OrangeHub';
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(titleText)}`, '_blank');
    setShowShareMenu(false);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) {
      showToast('Comment is too long (max 500 characters)');
      return;
    }

    const uid = getUserId();
    const authorName = commentAuthor.trim() || 'Anonymous';

    setSubmittingComment(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vkey,
          uid,
          author: authorName,
          text: trimmed,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.comment) {
        setComments((prev) => [data.comment, ...prev]);
        setNewComment('');
        showToast('Comment posted!');
      } else if (res.status === 429) {
        showToast(data?.error || 'Please wait 30s before posting another comment');
      } else {
        // Fallback optimistic local comment
        const fallbackComment = {
          id: 'local_' + Date.now(),
          user: authorName,
          avatar: `/api/avatar?name=${encodeURIComponent(authorName)}`,
          date: 'Just now',
          message: trimmed,
          upvotes: 0,
        };
        setComments((prev) => [fallbackComment, ...prev]);
        setNewComment('');
        try {
          const stored = localStorage.getItem(`oh_comments_${vkey}`);
          const list = stored ? JSON.parse(stored) : [];
          list.unshift(fallbackComment);
          localStorage.setItem(`oh_comments_${vkey}`, JSON.stringify(list));
        } catch {}
        showToast(data?.error || 'Comment posted!');
      }
    } catch {
      // Graceful degradation on network error
      const fallbackComment = {
        id: 'local_' + Date.now(),
        user: authorName,
        avatar: `/api/avatar?name=${encodeURIComponent(authorName)}`,
        date: 'Just now',
        message: trimmed,
        upvotes: 0,
      };
      setComments((prev) => [fallbackComment, ...prev]);
      setNewComment('');
      try {
        const stored = localStorage.getItem(`oh_comments_${vkey}`);
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(fallbackComment);
        localStorage.setItem(`oh_comments_${vkey}`, JSON.stringify(list));
      } catch {}
      showToast('Comment posted locally');
    } finally {
      setSubmittingComment(false);
    }
  };

  const likeComment = (cId) => {
    setCommentLikes((prev) => {
      const current = prev[cId] || 0;
      const next = current ? 0 : 1;
      return { ...prev, [cId]: next };
    });
  };

  if (err && !v) {
    const isNotFound = /not found|404/i.test(err);
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-16 relative text-center">
        <div className="max-w-md mx-auto p-8 rounded-2xl bg-[#141414] border border-[#2a2a2a] shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-[#ff9900]/15 flex items-center justify-center text-[#ff9900] ring-1 ring-[#ff9900]/30 mx-auto mb-4 animate-pulse">
            <IconAlert size={28} />
          </div>
          <h2 className="text-xl font-black text-white mb-2">
            {isNotFound ? 'Video Not Found' : 'Video Stream Notice'}
          </h2>
          <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
            {isNotFound
              ? 'This video does not exist or has been removed from OrangeHub.'
              : (err || 'Connection to stream was interrupted. Click Retry to reconnect.')}
          </p>
          <div className="flex items-center justify-center gap-3">
            {!isNotFound && (
              <button
                onClick={() => {
                  setErr(null);
                  fetch(`/api/video?vkey=${vkey}&refresh=1`)
                    .then((r) => r.json())
                    .then((j) => {
                      if (j && j.vkey) setV(j);
                    })
                    .catch(() => location.reload());
                }}
                className="px-6 py-2.5 rounded-xl bg-[#ff9900] text-black font-bold text-xs hover:bg-[#e68a00] transition-colors shadow-lg shadow-[#ff9900]/20 cursor-pointer"
              >
                Retry Video
              </button>
            )}
            <Link
              href="/"
              className="px-6 py-2.5 rounded-xl bg-[#ff9900] text-black font-bold text-xs hover:bg-[#e68a00] transition-colors shadow-lg shadow-[#ff9900]/20 cursor-pointer"
            >
              Return Home
            </Link>
            <Link
              href="/list/hottest"
              className="px-5 py-2.5 rounded-xl bg-[#222] hover:bg-[#333] text-neutral-200 hover:text-white text-xs font-semibold transition-colors"
            >
              Browse Hottest
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const nextVideo = nextUpOverride || v?.related?.[0];

  const uploaderHref = useMemo(() => {
    if (!v) return '#';
    const rawUrl = v.authorLink || v.authorUrl || '';
    if (rawUrl.startsWith('/pornstar/')) {
      return `/pornstar/${rawUrl.replace('/pornstar/', '')}`;
    }
    if (rawUrl.startsWith('/channels/') || rawUrl.startsWith('/users/') || rawUrl.startsWith('/model/')) {
      return `/uploader${rawUrl}`;
    }
    const cleanName = (v.author || 'creator').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `/uploader/model/${cleanName}`;
  }, [v]);

  return (
    <div className={`mx-auto px-4 py-4 relative transition-all duration-300 ${theaterMode ? 'max-w-[1850px]' : 'max-w-[1600px]'}`}>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141414] border border-[#ff9900]/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 toast-slide text-sm font-medium backdrop-blur">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff9900] animate-ping" />
          {toast}
        </div>
      )}

      {/* Floating mini-player is rendered by the player container below when scrolled past */}

      {/* Standard 2-Column Responsive Grid with Persistent Player */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        {/* Unified Player Container (Never unmounts, preventing video pause/reset on theater toggle) */}
        <div
          ref={playerAnchorRef}
          className={`relative transition-all duration-300 ${
            theaterMode
              ? 'lg:col-span-2 w-full mb-2'
              : 'lg:col-start-1 lg:row-start-1 lg:col-span-1'
          }`}
        >
          {/* Placeholder keeps the layout stable while the real player floats */}
          {miniPlayerActive && (
            <div className="aspect-video rounded-xl bg-black/40 ring-1 ring-white/10" aria-hidden="true" />
          )}
          <div className={miniPlayerActive ? 'fixed right-4 z-40 w-[min(340px,80vw)] fade-in bottom-[max(1rem,env(safe-area-inset-bottom))]' : 'contents'}>
          {!v ? (
            <div className="aspect-video rounded-xl skeleton" />
          ) : (
            <Player
              key={vkey}
              vkey={vkey}
              title={v.title}
              streams={v.streams}
              poster={v.thumbnail}
              duration={v.duration}
              theaterMode={theaterMode}
              onToggleTheater={toggleTheater}
              onEnded={handleEnded}
              onPause={handlePause}
              onTimeUpdate={handleTimeUpdate}
              autoplayNext={autoplayNext}
              onToggleAutoplay={(val) => setAutoplayNext(val)}
              initialTime={initialTime}
              compact={miniPlayerActive}
              onExpand={() => playerAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              onQueuePlay={(vk) => router.push(`/watch/${vk}`)}
            />
          )}

          {/* Autoplay Next Countdown Overlay */}
          {nextCountdown !== null && nextVideo && (
            miniPlayerActive ? (
              /* Compact countdown for the floating mini-player */
              <div className="absolute inset-x-0 bottom-0 z-40 bg-black/90 backdrop-blur-md px-3 py-2 flex items-center gap-2 fade-in">
                <span className="text-[11px] font-bold text-[#ff9900] whitespace-nowrap">Up next {nextCountdown}s</span>
                <span className="text-[11px] text-white truncate flex-1">{nextVideo.title}</span>
                <button
                  onClick={() => router.push(`/watch/${nextVideo.vkey}`)}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-[#ff9900] text-black font-bold text-[11px]">
                  Play
                </button>
                <button
                  onClick={() => setNextCountdown(null)}
                  aria-label="Cancel autoplay"
                  className="shrink-0 w-7 h-7 rounded-full bg-[#222] text-neutral-300 flex items-center justify-center">
                  <IconX size={12} />
                </button>
              </div>
            ) : (
            <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center fade-in">
              <span className="text-xs font-bold uppercase tracking-wider text-[#ff9900] mb-2">Up next in {nextCountdown}s</span>
              <h3 className="text-xl font-bold text-white max-w-md line-clamp-2 mb-4">{nextVideo.title}</h3>
              <div className="w-48 aspect-video rounded-xl overflow-hidden mb-6 ring-2 ring-[#ff9900]/40 shadow-2xl relative">
                <img src={nextVideo.thumbnail} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded font-bold">{nextVideo.duration && nextVideo.duration !== '0:00' && nextVideo.duration !== '0' ? nextVideo.duration : '--:--'}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push(`/watch/${nextVideo.vkey}`)}
                  className="px-6 py-2.5 rounded-full bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold text-sm flex items-center gap-2 transition-all">
                  <IconPlayNext size={16} /> Play Now
                </button>
                <button
                  onClick={() => setNextCountdown(null)}
                  className="px-5 py-2.5 rounded-full bg-[#222] hover:bg-[#333] text-neutral-300 hover:text-white font-medium text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
            )
          )}
          </div>
        </div>

        {/* Main Details Column (Title, Actions, Description, Comments) */}
        <div className={`min-w-0 ${theaterMode ? 'lg:col-start-1 lg:row-start-2 lg:col-span-1' : 'lg:col-start-1 lg:row-start-2 lg:col-span-1'}`}>
          {v && (
            <div className="fade-in">
              <h1 className="text-lg md:text-[1.65rem] font-extrabold text-white mt-1 leading-[1.25] tracking-tight">{v.title}</h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm text-neutral-400">
                {(liveViews !== null || v.views) && (
                  <span className="flex items-center gap-1.5">
                    <IconEye size={16} className="text-neutral-500" />
                    {formatMaxViews(v.views, liveViews)}
                  </span>
                )}
                {v.percent !== null && <span className="text-[#ff9900] font-bold bg-[#ff9900]/10 px-2 py-0.5 rounded-md text-[13px]">{v.percent}% liked</span>}
                {v.duration && <span className="flex items-center gap-1.5"><IconClock size={16} className="text-neutral-500" />{v.duration !== '0:00' && v.duration !== '0' ? v.duration : '--:--'}</span>}
                {Boolean(
                  (v.uploadDate || v.added) &&
                  typeof (v.uploadDate || v.added) === 'string' &&
                  (v.uploadDate || v.added).trim() &&
                  !/\b(?:5[0-9]|[6-9]\d|\d{3,})\s*years?\s*ago\b/i.test(v.uploadDate || v.added) &&
                  !/1970/i.test(v.uploadDate || v.added)
                ) && (
                  <span>{(v.uploadDate || v.added).trim()}</span>
                )}
              </div>

              {/* Action Buttons Bar — Pornhub-style: compact horizontal scroll row */}
              <div className="flex items-center gap-2 mt-4 pb-4 border-b border-[#1f1f1f] overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {/* Like / Dislike */}
                <div className="flex rounded-full overflow-hidden bg-[#1c1c1c] ring-1 ring-[#2c2c2c] shrink-0">
                  <button onClick={() => doVote('up')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold transition-all ${vote === 'up' ? 'bg-[#ff9900] text-black' : 'text-neutral-200 hover:bg-[#2a2a2a]'}`}>
                    <IconThumbUp size={16} />{v.upVotes || ''}
                  </button>
                  <button onClick={() => doVote('down')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold border-l border-[#2c2c2c] transition-all ${vote === 'down' ? 'bg-[#ff9900] text-black' : 'text-neutral-200 hover:bg-[#2a2a2a]'}`}>
                    <IconThumbDown size={16} />{v.downVotes || ''}
                  </button>
                </div>

                {/* Favorite */}
                <button onClick={toggleSave}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all shrink-0 ${saved ? 'bg-[#ff9900] text-black' : 'bg-[#1c1c1c] ring-1 ring-[#2c2c2c] text-neutral-200 hover:bg-[#2a2a2a]'}`}>
                  <IconHeart size={16} className={saved ? 'fill-black' : ''} />
                  Favorite
                </button>

                {/* Playlist */}
                <button
                  onClick={openPlaylistModal}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1c1c1c] ring-1 ring-[#2c2c2c] text-neutral-200 hover:bg-[#2a2a2a] text-[13px] font-bold transition-all shrink-0"
                  title="Save to Playlist"
                >
                  <IconList size={16} />
                  <span>Playlist</span>
                </button>

                {/* Watch Later */}
                <button
                  onClick={toggleWatchLater}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all shrink-0 ${watchLater ? 'bg-[#ff9900] text-black' : 'bg-[#1c1c1c] ring-1 ring-[#2c2c2c] text-neutral-200 hover:bg-[#2a2a2a]'}`}
                  title={watchLater ? 'Remove from Watch Later' : 'Save to Watch Later'}
                >
                  <IconClock size={16} />
                  <span>{watchLater ? 'Saved' : 'Watch Later'}</span>
                </button>

                {/* Queue */}
                <button
                  onClick={addCurrentToQueue}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1c1c1c] ring-1 ring-[#2c2c2c] text-neutral-200 hover:bg-[#2a2a2a] text-[13px] font-bold transition-all shrink-0"
                  title="Add to up-next queue"
                >
                  <IconPlayNext size={16} />
                  <span>Queue</span>
                </button>

                {/* Share */}
                <button
                  onClick={() => copyShare(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1c1c1c] ring-1 ring-[#2c2c2c] text-neutral-200 hover:bg-[#2a2a2a] text-[13px] font-bold transition-all shrink-0"
                  title="Share Video"
                >
                  <IconShare size={16} />
                  <span>{copied ? 'Copied!' : 'Share'}</span>
                </button>

                {/* Download */}
                <button
                  onClick={openDownloadSheet}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1c1c1c] ring-1 ring-[#2c2c2c] text-neutral-200 hover:bg-[#2a2a2a] text-[13px] font-bold transition-all shrink-0"
                  title="Download Video"
                >
                  <IconDownload size={16} />
                  <span>Download</span>
                </button>

                {/* Report */}
                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1c1c1c] ring-1 ring-[#2c2c2c] text-neutral-400 hover:text-white hover:bg-[#2a2a2a] text-[13px] font-bold transition-all shrink-0"
                  title="Report Video"
                >
                  <IconFlag size={15} />
                  <span>Report</span>
                </button>
              </div>

                {/* Autoplay & Theater are in the player settings/control bar — removed duplicates for clean UI */}
              {/* Save to Playlist Modal */}
              {showPlaylistModal && (
                <div
                  className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setShowPlaylistModal(false)}
                >
                  <div
                    className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#222]">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <IconList size={18} className="text-[#ff9900]" /> Save to Playlist
                      </h3>
                      <button
                        onClick={() => setShowPlaylistModal(false)}
                        className="text-neutral-400 hover:text-white p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#222] transition-colors"
                      >
                        <IconX size={18} />
                      </button>
                    </div>

                    {loadingPlaylists ? (
                      <div className="py-8 text-center text-neutral-400 flex items-center justify-center gap-2 text-sm">
                        <IconSpinner size={18} /> Loading your playlists...
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-4">
                        {userPlaylists.length === 0 ? (
                          <p className="text-xs text-neutral-400 py-3 text-center">
                            No playlists found. Create your first playlist below!
                          </p>
                        ) : (
                          userPlaylists.map((pl) => {
                            const inPlaylist = savedPlaylistIds.has(pl.id);
                            return (
                              <div
                                key={pl.id}
                                onClick={() => togglePlaylistMembership(pl)}
                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                  inPlaylist
                                    ? 'bg-[#ff9900]/10 border-[#ff9900]/40 text-white'
                                    : 'bg-[#1a1a1a] border-[#262626] text-neutral-300 hover:border-neutral-500'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="text-sm font-semibold truncate">{pl.name}</p>
                                  <p className="text-[11px] text-neutral-400">
                                    {pl.items?.length || 0} videos
                                  </p>
                                </div>
                                <div
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                    inPlaylist
                                      ? 'bg-[#ff9900] text-black'
                                      : 'border border-neutral-600 bg-neutral-800'
                                  }`}
                                >
                                  {inPlaylist && <IconCheck size={14} className="stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* Create New Playlist Form */}
                    <form onSubmit={handleCreatePlaylist} className="pt-3 border-t border-[#222]">
                      <label className="block text-xs font-semibold text-neutral-400 mb-2">
                        Create New Playlist
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPlaylistName}
                          onChange={(e) => setNewPlaylistName(e.target.value)}
                          placeholder="Playlist name..."
                          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9900]"
                        />
                        <button
                          type="submit"
                          disabled={!newPlaylistName.trim() || creatingPlaylist}
                          className="px-4 py-2 bg-[#ff9900] disabled:opacity-40 text-black font-bold text-xs rounded-xl hover:bg-[#e68a00] flex items-center gap-1.5 transition-colors shrink-0"
                        >
                          {creatingPlaylist ? <IconSpinner size={14} /> : <IconPlus size={14} />}
                          <span>Create</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* QR Code Share Modal */}
              {showQrModal && (
                <div
                  className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 fade-in"
                  onClick={() => setShowQrModal(false)}
                >
                  <div
                    className="bg-[#141414] border border-[#2a2a2a] rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#222]">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <IconQr size={20} className="text-[#ff9900]" />
                        Scan QR to Watch
                      </h3>
                      <button
                        onClick={() => setShowQrModal(false)}
                        className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-[#222] transition-colors"
                      >
                        <IconX size={18} />
                      </button>
                    </div>

                    <p className="text-xs text-neutral-400 mb-4">
                      Scan with your phone camera or TV scanner to open this video instantly
                    </p>

                    {/* QR Code Container */}
                    <div className="p-3 bg-white rounded-2xl inline-block shadow-2xl mx-auto ring-4 ring-[#ff9900]/20">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: generateQrSvg(getShareUrl(qrWithTimestamp), {
                            size: 200,
                            margin: 1,
                            darkColor: '#000000',
                            lightColor: '#ffffff'
                          })
                        }}
                      />
                    </div>

                    {/* Timestamp Toggle */}
                    <div className="mt-4 pt-4 border-t border-[#222] flex items-center justify-between px-2">
                      <label className="text-xs font-semibold text-neutral-300 flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qrWithTimestamp}
                          onChange={(e) => setQrWithTimestamp(e.target.checked)}
                          className="rounded accent-[#ff9900] w-4 h-4 cursor-pointer"
                        />
                        <span>Start at {Math.round(playbackTime)}s</span>
                      </label>
                      {qrWithTimestamp && (
                        <span className="text-[11px] font-mono text-[#ff9900] font-bold">?t={Math.round(playbackTime)}</span>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => copyShare(qrWithTimestamp)}
                        className="flex-1 py-2.5 rounded-xl bg-[#222] hover:bg-[#333] text-neutral-200 text-xs font-bold transition-colors"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => setShowQrModal(false)}
                        className="flex-1 py-2.5 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] text-black text-xs font-bold transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Report Video Modal */}
              {/* Download Quality Bottom Sheet */}
              {showDownloadSheet && (
                <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Download video">
                  <div
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    onClick={() => setShowDownloadSheet(false)}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-[#141414] border-t border-[#2a2a2a] rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col">
                    <div className="pt-3 pb-2 flex justify-center shrink-0">
                      <div className="w-10 h-1.5 rounded-full bg-[#3a3a3a]" />
                    </div>
                    <div className="flex items-center justify-between px-5 pb-3 shrink-0">
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <IconDownload size={18} className="text-[#ff9900]" />
                        Download Video
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowDownloadSheet(false)}
                        className="w-9 h-9 rounded-full bg-[#1f1f1f] text-neutral-400 hover:text-white flex items-center justify-center"
                        aria-label="Close"
                      >
                        <IconX size={16} />
                      </button>
                    </div>
                    <div className="overflow-y-auto px-4 pb-6 space-y-2">
                      {downloadLoading ? (
                        <div className="flex items-center justify-center py-8 text-neutral-400 text-sm">
                          <IconSpinner size={20} className="animate-spin mr-2" />
                          Loading qualities...
                        </div>
                      ) : downloadQualities.length > 0 ? (
                        downloadQualities.map((dq) => (
                          <a
                            key={dq.quality}
                            href={dq.url}
                            download
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#1c1c1c] hover:bg-[#ff9900] hover:text-black text-white transition-colors group"
                            onClick={() => setShowDownloadSheet(false)}
                          >
                            <span className="flex items-center gap-3">
                              <span className="w-9 h-9 rounded-xl bg-[#ff9900]/15 group-hover:bg-black/10 flex items-center justify-center text-[#ff9900] group-hover:text-black">
                                <IconDownload size={16} />
                              </span>
                              <span>
                                <span className="block text-sm font-bold">
                                  {/^\d+$/.test(dq.quality) ? `${dq.quality}p` : 'HD Video'}
                                  <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded bg-[#ff9900]/20 text-[#ff9900] group-hover:bg-black/20 group-hover:text-black uppercase">
                                    {dq.format === 'hls' ? 'HLS' : 'MP4'}
                                  </span>
                                </span>
                                <span className="block text-xs text-neutral-500 group-hover:text-black/60">
                                  {dq.format === 'hls' ? 'Plays in VLC / MX Player' : 'MP4 video file'}
                                </span>
                              </span>
                            </span>
                            <IconChevronR size={18} className="text-neutral-600 group-hover:text-black" />
                          </a>
                        ))
                      ) : (
                        <div className="text-center py-8 px-4">
                          <p className="text-neutral-400 text-sm mb-1">Download not available</p>
                          <p className="text-neutral-600 text-xs">Try again later or try a different video.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {showReportModal && (
                <div
                  className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setShowReportModal(false)}
                >
                  <div
                    className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#222]">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <IconFlag size={18} className="text-[#ff9900]" /> Report Video
                      </h3>
                      <button
                        onClick={() => setShowReportModal(false)}
                        className="text-neutral-400 hover:text-white p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#222] transition-colors"
                      >
                        <IconX size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleReportSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                          Reason for report <span className="text-[#ff9900]">*</span>
                        </label>
                        <select
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff9900]"
                        >
                          <option value="broken_video">Broken video (fails to play or stream error)</option>
                          <option value="wrong_title">Wrong or misleading title</option>
                          <option value="thumbnail_mismatch">Thumbnail mismatch</option>
                          <option value="other">Other issue</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                          Details (optional)
                        </label>
                        <textarea
                          value={reportDetails}
                          onChange={(e) => setReportDetails(e.target.value)}
                          rows={3}
                          placeholder="Tell us what went wrong..."
                          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9900] resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowReportModal(false)}
                          className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#333] text-neutral-300 text-xs font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingReport}
                          className="px-5 py-2 rounded-xl bg-[#ff9900] disabled:opacity-40 text-black text-xs font-bold hover:bg-[#e68a00] flex items-center gap-1.5 transition-colors"
                        >
                          {submittingReport ? <IconSpinner size={14} /> : <IconSend size={14} />}
                          <span>Submit Report</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* UPLOADER PROFILE CARD */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mt-6 p-5 rounded-2xl bg-gradient-to-r from-[#141414] to-[#0e0e0e] border border-[#222] shadow-xl">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#ff9900]/60 bg-[#1c1c1c] flex items-center justify-center glow-pulse shadow-lg shadow-[#ff9900]/10">
                      {v.authorAvatar ? (
                        <img
                          src={v.authorAvatar}
                          alt={v.author || 'Uploader'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span className={`w-full h-full items-center justify-center font-bold text-xl text-black bg-[#ff9900] ${v.authorAvatar ? 'hidden' : 'flex'}`}>
                        {(v.author || 'C').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#ff9900] text-black flex items-center justify-center shadow-md" title="Verified Creator">
                      <IconCheck size={14} className="stroke-[3]" />
                    </span>
                  </div>

                  {/* Channel Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={uploaderHref}
                        className="font-bold text-white text-lg hover:text-[#ff9900] transition-colors truncate">
                        {v.author || 'Verified Creator'}
                      </Link>
                      <span className="px-2 py-0.5 rounded-full bg-[#ff9900]/10 border border-[#ff9900]/30 text-[#ff9900] text-[11px] font-semibold flex items-center gap-1 shrink-0">
                        <IconBadgeCheck size={13} /> {v.authorBadge || 'Verified Model'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400 mt-1">
                      <span className="font-semibold text-neutral-200">{formatCount(subCount)}</span>
                      <span>•</span>
                      <span>{formatCount(v.authorVideos || '68 Videos')}</span>
                      <span>•</span>
                      <span className="text-[#ff9900]">Featured Studio</span>
                    </div>
                  </div>
                </div>

                {/* Subscribe Button */}
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={toggleSubscribe}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all shadow-md active:scale-95 ${
                      subscribed
                        ? 'bg-[#1f1f1f] text-neutral-300 ring-1 ring-[#333] hover:ring-neutral-500 hover:text-white'
                        : 'bg-[#ff9900] text-black hover:bg-[#e68a00] hover:shadow-lg hover:shadow-[#ff9900]/25'
                    }`}>
                    {subscribed ? (
                      <>
                        <IconCheck size={17} className="text-[#ff9900]" />
                        <span>Subscribed</span>
                      </>
                    ) : (
                      <>
                        <IconBell size={17} />
                        <span>Subscribe</span>
                      </>
                    )}
                  </button>
                  <Link href={uploaderHref}
                    className="px-4 py-3 rounded-full bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-neutral-300 hover:text-white text-xs font-semibold transition-colors">
                    All Videos
                  </Link>
                </div>
              </div>

              {/* MORE FROM THIS UPLOADER BLOCK */}
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-[#181818] via-[#141414] to-[#101010] border border-[#ff9900]/25 flex items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#ff9900]/15 text-[#ff9900] flex items-center justify-center shrink-0">
                    <IconUser size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#ff9900]">Featured Channel</p>
                    <h3 className="text-sm font-bold text-white truncate">More videos from {v.author || 'this uploader'}</h3>
                  </div>
                </div>
                <Link
                  href={uploaderHref}
                  className="shrink-0 px-4 py-2 rounded-xl bg-[#ff9900] hover:bg-[#ffa826] text-black font-bold text-xs transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <span>Explore Channel</span>
                  <IconChevronR size={14} />
                </Link>
              </div>

              {/* EXPANDABLE VIDEO INFO / BIO */}
              <div className="mt-5 p-4 rounded-xl bg-[#121212] border border-[#1f1f1f] text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-300 flex items-center gap-2">
                    <IconSparkles size={16} className="text-[#ff9900]" />
                    About this video & creator
                  </span>
                  <button onClick={() => setDescOpen(!descOpen)} className="text-xs text-[#ff9900] hover:underline font-semibold">
                    {descOpen ? 'Show less' : 'Show more'}
                  </button>
                </div>
                <p className={`text-neutral-400 mt-2 leading-relaxed transition-all ${descOpen ? '' : 'line-clamp-2'}`}>
                  {v.authorBio || `Watch ${v.title} in crystal clear Full HD on OrangeHub. Uploaded by ${v.author || 'verified creator'}. Stream seamlessly on any device.`}
                </p>

                {/* Categories, Tags & Pornstars */}
                <div className="mt-4 pt-4 border-t border-[#1f1f1f] space-y-3">
                  {(() => {
                    const validPornstars = (v.pornstars || []).filter((p) => {
                      if (!p || !p.name) return false;
                      const name = String(p.name).trim();
                      const slug = String(p.slug || '').trim();
                      return !/^\d+$/.test(name) && !/^\d+$/.test(slug);
                    });
                    if (validPornstars.length === 0) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                          <IconStar size={12} className="text-[#ff9900]" /> Pornstars:
                        </span>
                        {validPornstars.map((p) => (
                          <Link
                            key={p.slug}
                            href={`/pornstar/${p.slug}`}
                            className="px-3 py-1 rounded-full bg-[#ff9900]/15 border border-[#ff9900]/30 text-[12px] text-[#ff9900] hover:bg-[#ff9900] hover:text-black transition-all font-semibold"
                          >
                            {p.name}
                          </Link>
                        ))}
                      </div>
                    );
                  })()}

                  {v.categories?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mr-1">Categories:</span>
                      {(v.categories || []).map(c => (
                        <Link key={c.name} href={c.slug?.startsWith('/video?c=') ? `/category?slug=${encodeURIComponent(c.slug)}` : `/search?q=${encodeURIComponent(c.name)}`}
                          className="px-3 py-1 rounded-full bg-[#ff9900]/10 border border-[#ff9900]/25 text-[12px] text-[#ff9900] hover:bg-[#ff9900] hover:text-black transition-all font-semibold">
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  {v.tags?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                        <IconTag size={12} /> Tags:
                      </span>
                      {(v.tags || []).map(t => (
                        <Link key={t} href={`/search?q=${encodeURIComponent(t)}`}
                          className="px-2.5 py-0.5 rounded bg-[#1c1c1c] text-[11px] text-neutral-400 hover:text-white hover:bg-[#282828] transition-colors">
                          #{t}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* COMMENTS SECTION */}
              <div className="mt-8 pt-8 border-t border-[#1f1f1f]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                    <IconMessage size={22} className="text-[#ff9900]" />
                    Comments
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1c1c1c] text-xs font-semibold text-neutral-400">
                      {comments.length}
                    </span>
                  </h2>
                  <span className="text-xs text-neutral-500">Sorted by Newest</span>
                </div>

                {/* New Comment Input */}
                <form onSubmit={handleAddComment} className="flex flex-col gap-3 mb-8 p-4 rounded-2xl bg-[#121212] border border-[#222]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#ff9900] text-black font-extrabold flex items-center justify-center shrink-0 text-xs shadow">
                      {commentAuthor ? commentAuthor.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <input
                      type="text"
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                      placeholder="Your name (optional, defaults to Anonymous)"
                      maxLength={40}
                      className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9900] transition-colors"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add an anonymous comment... (max 500 characters)"
                      maxLength={500}
                      className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9900] transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim() || submittingComment}
                      className="px-5 py-2.5 rounded-xl bg-[#ff9900] disabled:opacity-40 disabled:hover:bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                      <IconSend size={15} /> {submittingComment ? 'Posting...' : 'Comment'}
                    </button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-4">
                  {(comments || []).map((c, idx) => {
                    const isLiked = !!commentLikes[c.id];
                    const likeTotal = (c.upvotes || 0) + (isLiked ? 1 : 0);

                    return (
                      <div key={c.id || idx} className="p-4 rounded-xl bg-[#111] border border-[#1d1d1d] flex gap-3.5 card-in" style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}>
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1f1f1f] ring-1 ring-white/10 shrink-0 flex items-center justify-center">
                          {c.avatar ? (
                            <img
                              src={c.avatar}
                              alt={c.user}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span className={`w-full h-full items-center justify-center text-xs font-bold text-[#ff9900] bg-[#1a1a1a] ${c.avatar ? 'hidden' : 'flex'}`}>
                            {(c?.user || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white hover:text-[#ff9900] transition-colors cursor-pointer">
                              {c?.user || 'User'}
                            </span>
                            <span className="text-[11px] text-neutral-500">• {c.date}</span>
                          </div>

                          <p className="text-sm text-neutral-300 mt-1 leading-relaxed break-words">
                            {c.message}
                          </p>

                          {/* Comment Actions */}
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <button
                              onClick={() => likeComment(c.id)}
                              className={`flex items-center gap-1.5 p-2 -m-2 rounded-lg transition-colors font-medium ${isLiked ? 'text-[#ff9900]' : 'text-neutral-400 hover:text-white'}`}>
                              <IconThumbUp size={14} className={isLiked ? 'fill-[#ff9900]' : ''} />
                              <span>{likeTotal}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Related videos sidebar */}
        <aside className={`min-w-0 self-start ${theaterMode ? 'lg:col-start-2 lg:row-start-2 lg:col-span-1' : 'lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:col-span-1'}`}>
          {/* More from this uploader block */}
          {v && (v.authorUrl || v.author) && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#101010] border border-white/[0.06] shadow-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-[#222] ring-2 ring-[#ff9900]/50 ring-offset-2 ring-offset-[#0a0a0a] shrink-0">
                  <img
                    src={v.authorAvatar || `/api/avatar?name=${encodeURIComponent(v.author || 'Creator')}`}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `/api/avatar?name=${encodeURIComponent(v.author || 'Creator')}`;
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[#ff9900] font-bold uppercase tracking-widest">Creator</p>
                  <p className="text-sm font-bold text-white truncate">{v.author}</p>
                </div>
              </div>
              <Link
                href={
                  v.authorUrl
                    ? (v.authorUrl.startsWith('/pornstar/')
                        ? v.authorUrl
                        : `/uploader${v.authorUrl.startsWith('/') ? '' : '/'}${v.authorUrl}`)
                    : `/pornstar/${v.author.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
                }
                className="px-4 py-2 rounded-xl bg-[#ff9900] hover:bg-[#ffb340] text-black text-xs font-black transition-all shadow-[0_4px_15px_rgba(255,153,0,0.3)] hover:shadow-[0_4px_20px_rgba(255,153,0,0.5)] shrink-0"
              >
                More Videos
              </Link>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-white tracking-tight">
              <span className="w-8 h-8 rounded-lg bg-[#ff9900]/10 border border-[#ff9900]/20 flex items-center justify-center text-[#ff9900]">
                <IconChevronR size={16} />
              </span>
              Related videos
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <span>Autoplay</span>
              <button
                onClick={toggleAutoplay}
                className={`w-8 h-4 rounded-full transition-colors relative ${autoplayNext ? 'bg-[#ff9900]' : 'bg-[#333]'}`}
              >
                <span className={`block w-3 h-3 rounded-full bg-black transition-transform ${autoplayNext ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {!v ? (
            <VideoGridSkeleton n={6} />
          ) : (
            <div className="flex flex-col gap-4">
              {(v.related || []).map((r, i) => (
                <Link
                  key={r.vkey || i}
                  href={`/watch/${r.vkey}`}
                  className="card-in group flex gap-3 p-1.5 rounded-xl hover:bg-[#141414] transition-colors"
                  style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                  <div className="relative w-44 shrink-0 aspect-video rounded-lg overflow-hidden bg-[#141414] ring-1 ring-white/5 group-hover:ring-[#ff9900]/60 transition-all">
                    {r.thumbnail && (
                      <img
                        src={r.thumbnail}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    {r.duration && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                        {r.duration !== '0:00' && r.duration !== '0' ? r.duration : '--:--'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const added = addToQueue({
                          vkey: r.vkey,
                          title: r.title,
                          thumbnail: r.thumbnail,
                          duration: r.duration,
                          views: r.views,
                          author: r.author,
                        });
                        haptic();
                        showToast(added ? 'Added to queue — plays next' : 'Already in queue');
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="absolute top-1.5 right-1.5 w-10 h-10 rounded-full bg-black/75 text-neutral-300 hover:text-[#ff9900] hover:bg-black/90 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-all flex items-center justify-center shadow-md z-10 active:scale-90 cursor-pointer"
                      title="Add to up-next queue"
                      aria-label="Add to up-next queue"
                    >
                      <IconPlus size={16} />
                    </button>
                  </div>
                  <div className="min-w-0 py-0.5">
                    <p className="clamp-2 text-[13px] font-medium text-neutral-100 group-hover:text-[#ff9900] transition-colors leading-snug">
                      {r.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1">
                      {r.author && <span className="text-neutral-300 truncate max-w-[120px]">{r.author}</span>}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {r.views ? formatViews(r.views) : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="max-w-[1600px] mx-auto px-4 py-8"><div className="aspect-video rounded-xl skeleton max-w-4xl" /></div>}>
      <WatchContent />
    </Suspense>
  );
}
