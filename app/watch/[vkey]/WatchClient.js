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
  IconWhatsApp, IconTelegram, IconQr
} from '../../../components/Icons';
import { generateQrSvg } from '../../../lib/qr';
import { formatCount, formatViews, formatMaxViews } from '../../../lib/format';

function WatchContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vkey = params?.vkey;
  const initialTime = Math.max(0, parseFloat(searchParams?.get('t') || '0'));
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
  const [submittingReport, setSubmittingReport] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

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
        let r = await fetch(`/api/video?vkey=${vkey}`);
        if (!r.ok) {
          r = await fetch(`/api/video?vkey=${vkey}&refresh=1`);
        }
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed to load video');
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
        setComments(allComments.map((c, i) => ({
          ...c,
          user: c?.user || 'User_' + (i + 1),
        })));
      } catch (e) {
        setErr(e.message);
      }
    })();
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
  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) {
      const nextVkey = v?.related?.[0]?.vkey;
      if (nextVkey) {
        router.push(`/watch/${nextVkey}`);
      }
      return;
    }
    const t = setTimeout(() => {
      setNextCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => clearTimeout(t);
  }, [nextCountdown, v, router]);

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
    if (!autoplayNext || !v?.related?.length) return;
    const nextVideo = v.related[0];
    if (nextVideo?.vkey) {
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

  const nextVideo = v?.related?.[0];

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

      {/* Floating Mini-Player Pill when scrolled down past video */}
      {isScrolledPast && v && (
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-6 z-40 bg-[#141414]/95 border border-[#ff9900]/40 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 cursor-pointer hover:border-[#ff9900] transition-all max-w-sm backdrop-blur fade-in group"
          title="Click to scroll back to video player"
        >
          <div className="relative w-16 aspect-video rounded-lg overflow-hidden bg-black shrink-0">
            <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-[#ff9900] animate-ping" />
            </div>
          </div>
          <div className="min-w-0 pr-2">
            <p className="text-xs font-bold text-white truncate group-hover:text-[#ff9900] transition-colors">{v.title}</p>
            <p className="text-[11px] text-neutral-400 truncate">{v.author || 'Playing now'} • Return to video ↑</p>
          </div>
        </div>
      )}

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
          {!v ? (
            <div className="aspect-video rounded-xl skeleton" />
          ) : (
            <Player
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
            />
          )}

          {/* Autoplay Next Countdown Overlay */}
          {nextCountdown !== null && nextVideo && (
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
          )}
        </div>

        {/* Main Details Column (Title, Actions, Description, Comments) */}
        <div className={`min-w-0 ${theaterMode ? 'lg:col-start-1 lg:row-start-2 lg:col-span-1' : 'lg:col-start-1 lg:row-start-2 lg:col-span-1'}`}>
          {v && (
            <div className="fade-in">
              <h1 className="text-lg md:text-2xl font-bold text-white mt-1 leading-snug">{v.title}</h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm text-neutral-400">
                {(liveViews !== null || v.views) && (
                  <span className="flex items-center gap-1.5">
                    <IconEye size={16} />
                    {formatMaxViews(v.views, liveViews)}
                  </span>
                )}
                {v.percent !== null && <span className="text-[#ff9900] font-bold">{v.percent}% liked</span>}
                {v.duration && <span className="flex items-center gap-1.5"><IconClock size={16} />{v.duration !== '0:00' && v.duration !== '0' ? v.duration : '--:--'}</span>}
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

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pb-5 border-b border-[#1f1f1f]">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Like / Dislike */}
                  <div className="flex rounded-full overflow-hidden ring-1 ring-[#2c2c2c]">
                    <button onClick={() => doVote('up')}
                      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all ${vote === 'up' ? 'bg-[#ff9900] text-black shadow-lg shadow-[#ff9900]/25 heart-pop' : 'bg-[#1c1c1c] text-neutral-300 hover:bg-[#2a2a2a]'}`}>
                      <IconThumbUp size={17} />{v.upVotes || 'Like'}
                    </button>
                    <button onClick={() => doVote('down')}
                      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-l border-[#2c2c2c] transition-all ${vote === 'down' ? 'bg-[#ff9900] text-black heart-pop' : 'bg-[#1c1c1c] text-neutral-300 hover:bg-[#2a2a2a]'}`}>
                      <IconThumbDown size={17} />{v.downVotes || ''}
                    </button>
                  </div>

                  {/* Save to Favorites */}
                  <button onClick={toggleSave}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full ring-1 text-sm font-bold transition-all ${saved ? 'bg-[#ff9900]/15 ring-[#ff9900] text-[#ff9900] heart-pop shadow-md shadow-[#ff9900]/20' : 'bg-[#1c1c1c] ring-[#2c2c2c] text-neutral-200 hover:bg-[#2a2a2a]'}`}>
                    <IconHeart size={17} className={saved ? 'fill-[#ff9900]' : ''} />
                    {saved ? 'Favorited' : 'Favorite'}
                  </button>

                  {/* Save to Playlist */}
                  <button
                    onClick={openPlaylistModal}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full ring-1 ring-[#2c2c2c] bg-[#1c1c1c] text-neutral-200 hover:bg-[#2a2a2a] text-sm font-bold transition-all"
                    title="Save to Playlist"
                  >
                    <IconList size={17} />
                    <span>Playlist</span>
                  </button>

                  {/* Report Video */}
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full ring-1 ring-[#2c2c2c] bg-[#1c1c1c] text-neutral-300 hover:text-white hover:bg-[#2a2a2a] text-sm font-bold transition-all"
                    title="Report Video"
                  >
                    <IconFlag size={16} />
                    <span>Report</span>
                  </button>

                  {/* Share Menu & Direct Social Buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* Main Share Button with dropdown */}
                    <div className="relative">
                      <div className="flex rounded-full overflow-hidden ring-1 ring-[#2c2c2c] bg-[#1c1c1c]">
                        <button
                          onClick={() => copyShare(false)}
                          className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-bold text-neutral-200 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <IconShare size={16} /> {copied ? 'Copied!' : 'Share'}
                        </button>
                        <button
                          onClick={() => setShowShareMenu((s) => !s)}
                          className="px-2 py-2.5 text-xs font-bold text-neutral-400 hover:text-[#ff9900] hover:bg-[#2a2a2a] border-l border-[#2c2c2c] transition-colors"
                          title="Share Options"
                        >
                          ▾
                        </button>
                      </div>

                      {showShareMenu && (
                        <div className="absolute left-0 top-12 z-30 bg-[#161616] border border-[#2a2a2a] rounded-2xl p-1.5 shadow-2xl min-w-[230px] flex flex-col gap-1 backdrop-blur-md">
                          <button
                            onClick={() => copyShare(false)}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-neutral-200 hover:bg-[#252525] transition-colors flex items-center justify-between"
                          >
                            <span>Copy Video Link</span>
                            <IconShare size={13} className="text-neutral-500" />
                          </button>
                          <button
                            onClick={() => copyShare(true)}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#ff9900] hover:bg-[#252525] transition-colors flex items-center justify-between"
                          >
                            <span>Copy with Timestamp ({Math.round(playbackTime)}s)</span>
                            <span className="font-mono text-[10px] bg-[#ff9900]/20 px-1 py-0.5 rounded text-[#ff9900]">?t={Math.round(playbackTime)}</span>
                          </button>
                          <div className="h-px bg-[#262626] my-1" />
                          <button
                            onClick={() => shareWhatsApp(false)}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:bg-[#252525] transition-colors flex items-center gap-2"
                          >
                            <IconWhatsApp size={15} />
                            <span>Share on WhatsApp</span>
                          </button>
                          <button
                            onClick={() => shareTelegram(false)}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-sky-400 hover:bg-[#252525] transition-colors flex items-center gap-2"
                          >
                            <IconTelegram size={15} />
                            <span>Share on Telegram</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowShareMenu(false);
                              setShowQrModal(true);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-neutral-200 hover:bg-[#252525] transition-colors flex items-center gap-2"
                          >
                            <IconQr size={15} className="text-[#ff9900]" />
                            <span>Show QR Code</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Quick Share Button */}
                    <button
                      onClick={() => shareWhatsApp(false)}
                      className="p-2.5 rounded-full ring-1 ring-[#2c2c2c] bg-[#1c1c1c] text-neutral-300 hover:text-emerald-400 hover:bg-[#2a2a2a] transition-all"
                      title="Share on WhatsApp"
                      aria-label="Share on WhatsApp"
                    >
                      <IconWhatsApp size={16} />
                    </button>

                    {/* Telegram Quick Share Button */}
                    <button
                      onClick={() => shareTelegram(false)}
                      className="p-2.5 rounded-full ring-1 ring-[#2c2c2c] bg-[#1c1c1c] text-neutral-300 hover:text-sky-400 hover:bg-[#2a2a2a] transition-all"
                      title="Share on Telegram"
                      aria-label="Share on Telegram"
                    >
                      <IconTelegram size={16} />
                    </button>

                    {/* QR Code Quick Button */}
                    <button
                      onClick={() => setShowQrModal(true)}
                      className="p-2.5 rounded-full ring-1 ring-[#2c2c2c] bg-[#1c1c1c] text-neutral-300 hover:text-[#ff9900] hover:bg-[#2a2a2a] transition-all"
                      title="Show QR Code for Phone/TV"
                      aria-label="QR Code"
                    >
                      <IconQr size={16} />
                    </button>
                  </div>
                </div>

                {/* Autoplay & Theater quick toggles */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAutoplay}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${autoplayNext ? 'bg-[#ff9900]/15 text-[#ff9900] border border-[#ff9900]/30' : 'bg-[#181818] text-neutral-400 border border-[#252525]'}`}
                    title="Autoplay next video when current video ends"
                  >
                    <span>Autoplay</span>
                    <span className={`w-2 h-2 rounded-full ${autoplayNext ? 'bg-[#ff9900]' : 'bg-neutral-600'}`} />
                  </button>

                  <button
                    onClick={toggleTheater}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-colors ${theaterMode ? 'bg-[#ff9900] text-black border-[#ff9900]' : 'bg-[#181818] text-neutral-300 border-[#252525] hover:text-white'}`}
                    title={theaterMode ? 'Exit Theater Mode' : 'Theater Mode'}
                  >
                    <IconTheater size={16} />
                  </button>
                </div>
              </div>

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
                            <button
                              onClick={() => showToast('Replies feature coming soon')}
                              className="text-neutral-500 hover:text-neutral-300 font-medium transition-colors">
                              Reply
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
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#181818] to-[#121212] border border-[#262626] shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-[#222] ring-2 ring-[#ff9900]/40 shrink-0">
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
                  <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider">Creator</p>
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
                className="px-3.5 py-1.5 rounded-lg bg-[#ff9900] hover:bg-[#e68a00] text-black text-xs font-bold transition-all shadow shrink-0"
              >
                More Videos
              </Link>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Related videos <IconChevronR size={18} className="text-[#ff9900]" />
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
