// "Up next" queue store — transient localStorage-backed playback queue.
// Key: oh_queue_list (array of {vkey,title,thumbnail,duration,views,author,added})
import { hasRejectedFunctional } from './consent';

export const QUEUE_CHANGED_EVENT = 'oh_queue_changed';
const STORAGE_KEY = 'oh_queue_list';
const MAX_ITEMS = 100;

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
    window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT));
  } catch {}
}

export function getQueue() {
  try {
    if (hasRejectedFunctional()) return [];
    return readList();
  } catch {
    return [];
  }
}

// Returns true when added, false when already present or blocked by consent.
export function addToQueue(video) {
  try {
    if (hasRejectedFunctional()) return false;
    if (!video || !video.vkey) return false;
    const list = readList();
    if (list.some((item) => item && item.vkey === video.vkey)) return false;
    list.push({
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
    return false;
  }
}

// Returns true when an item was removed.
export function removeFromQueue(vkey) {
  try {
    if (hasRejectedFunctional() || !vkey) return false;
    const list = readList();
    const idx = list.findIndex((item) => item && item.vkey === vkey);
    if (idx === -1) return false;
    list.splice(idx, 1);
    writeList(list);
    dispatchChanged();
    return true;
  } catch {
    return false;
  }
}

export function clearQueue() {
  try {
    if (hasRejectedFunctional()) return;
    writeList([]);
    dispatchChanged();
  } catch {}
}

// Removes and returns the head item (or null when empty/blocked).
export function shiftQueue() {
  try {
    if (hasRejectedFunctional()) return null;
    const list = readList();
    if (list.length === 0) return null;
    const head = list.shift();
    writeList(list);
    dispatchChanged();
    return head || null;
  } catch {
    return null;
  }
}
