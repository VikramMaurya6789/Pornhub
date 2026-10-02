// Watch Later store — localStorage-backed, same shape as the favorites list.
// Key: oh_watchlater_list (array of {vkey,title,thumbnail,duration,views,author,added})
import { hasRejectedFunctional } from './consent';

export const WATCHLATER_CHANGED_EVENT = 'oh_watchlater_changed';
const STORAGE_KEY = 'oh_watchlater_list';
const MAX_ITEMS = 200;

function readList() {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

function dispatchChanged() {
  try {
    window.dispatchEvent(new CustomEvent(WATCHLATER_CHANGED_EVENT));
  } catch {}
}

export function getWatchLater() {
  try {
    if (hasRejectedFunctional()) return [];
    return readList();
  } catch {
    return [];
  }
}

export function isWatchLater(vkey) {
  if (!vkey) return false;
  try {
    if (hasRejectedFunctional()) return false;
    return readList().some((item) => item && item.vkey === vkey);
  } catch {
    return false;
  }
}

// Returns true when the video was ADDED, false when REMOVED,
// null when blocked by cookie consent (no write performed).
export function toggleWatchLater(video) {
  try {
    if (hasRejectedFunctional()) return null;
    if (!video || !video.vkey) return null;
    const list = readList();
    const idx = list.findIndex((item) => item && item.vkey === video.vkey);
    if (idx !== -1) {
      list.splice(idx, 1);
      writeList(list);
      dispatchChanged();
      return false;
    }
    list.unshift({
      vkey: video.vkey,
      title: video.title,
      thumbnail: video.thumbnail,
      duration: video.duration,
      views: video.views,
      author: video.author,
      added: Date.now(),
    });
    if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
    writeList(list);
    dispatchChanged();
    return true;
  } catch {
    return null;
  }
}

export function removeWatchLater(vkey) {
  try {
    if (hasRejectedFunctional() || !vkey) return;
    const list = readList();
    const idx = list.findIndex((item) => item && item.vkey === vkey);
    if (idx !== -1) {
      list.splice(idx, 1);
      writeList(list);
      dispatchChanged();
    }
  } catch {}
}

export function clearWatchLater() {
  try {
    if (hasRejectedFunctional()) return;
    writeList([]);
    dispatchChanged();
  } catch {}
}
