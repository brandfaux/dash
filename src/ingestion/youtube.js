/**
 * ingestion/youtube.js
 * YouTube API helpers — URL parsing and metadata fetching.
 */

/**
 * Extract video ID from various YouTube URL formats.
 * Supports: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/shorts/ID
 */
export function extractVideoId(url) {
  if (!url || typeof url !== 'string') return null;

  // youtu.be/ID
  let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // youtube.com/watch?v=ID (handles multiple params)
  match = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // youtube.com/shorts/ID
  match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // Just an ID (11 chars alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

  return null;
}

/**
 * Extract playlist ID from YouTube playlist URLs.
 * Supports: youtube.com/playlist?list=ID, youtube.com/?list=ID
 */
export function extractPlaylistId(url) {
  if (!url || typeof url !== 'string') return null;

  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch video metadata via noembed.com (no API key needed).
 * Returns { title, duration, author, ... } or null if fetch fails.
 */
export async function fetchVideoMeta(videoId) {
  if (!videoId) return null;

  try {
    const url = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      title: data.title || null,
      author: data.author_name || null,
      duration: data.duration || null,
      thumbnail: data.thumbnail_url || null,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Generate YouTube thumbnail URL for a video ID.
 * Returns highest quality available (maxresdefault → standard quality fallback).
 */
export function thumbnailUrl(videoId) {
  if (!videoId) return '';
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Test if a URL is a valid YouTube URL.
 */
export function isYouTubeUrl(url) {
  return /youtube\.com|youtu\.be/.test(url);
}
