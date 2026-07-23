
import { LinkCardContent } from "../types";

export const isValidUrl = (string: string): boolean => {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
};

const getFaviconUrl = (hostname: string) => {
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
};

// Is this a YouTube watch/short URL? Used to give pasted YT links a 16:9 card
// and enable inline playback.
export const isYouTubeUrl = (url: string): boolean => {
  try {
    const h = new URL(url).hostname.replace('www.', '');
    return h.includes('youtube.com') || h.includes('youtu.be');
  } catch { return false; }
};

export type UrlPlatform = 'youtube' | 'tiktok' | 'instagram' | 'pinterest' | 'generic';

// Cheap synchronous platform guess from the hostname (no network) — used for
// choosing the pasted/dropped card's initial size before metadata resolves.
export const guessUrlPlatform = (url: string): UrlPlatform => {
  try {
    const h = new URL(url).hostname.replace('www.', '');
    if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
    if (h.includes('tiktok.com')) return 'tiktok';
    if (h.includes('instagram.com')) return 'instagram';
    if (h.includes('pinterest.')) return 'pinterest';
    return 'generic';
  } catch { return 'generic'; }
};

// Human label for a platform's header, derived synchronously (no network) so a
// pasted card looks complete instantly.
export const platformLabel = (platform: UrlPlatform, url: string): string => {
  switch (platform) {
    case 'youtube': return 'YouTube';
    case 'tiktok': return 'TikTok';
    case 'instagram': return 'Instagram';
    case 'pinterest': return 'Pinterest';
    default:
      try { const h = new URL(url).hostname.replace('www.', ''); return h.charAt(0).toUpperCase() + h.slice(1).split('.')[0]; }
      catch { return url; }
  }
};

// Instagram post/reel shortcode from a URL (/p/, /reel/, /tv/), or ''.
export const instagramShortcode = (url: string): string => {
  const m = url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : '';
};

// Deterministic public cover image for an IG post/reel — no fetch, no key.
// The `/p/{code}/media/?size=l` endpoint returns the primary image directly.
export const instagramCoverUrl = (url: string): string => {
  const code = instagramShortcode(url);
  return code ? `https://www.instagram.com/p/${code}/media/?size=l` : '';
};

// True when a pasted link is a video (IG reel/tv, or any TikTok) → show Play.
export const isVideoLinkUrl = (url: string): boolean => {
  try {
    const h = new URL(url).hostname.replace('www.', '');
    if (h.includes('tiktok.com')) return true;
    if (h.includes('instagram.com')) return /\/(reel|reels|tv)\//i.test(url);
    return false;
  } catch { return false; }
};

// Deterministic YouTube thumbnail — no fetch needed. hqdefault ALWAYS exists
// (unlike maxresdefault which 404s on some videos), so the image is instant and
// never disappears after enrichment.
export const youTubeThumb = (videoId: string): string => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

/**
 * Instant, network-free seed for a freshly pasted/dropped link so the card
 * renders its final shape immediately; fetchLinkMetadata enriches in the
 * background. Returns partial LinkCardContent (never overwrites with blanks).
 */
export const seedLinkContent = (url: string): Partial<LinkCardContent> => {
  const platform = guessUrlPlatform(url);
  const ytId = platform === 'youtube' ? youTubeVideoId(url) : null;
  return {
    url,
    platform,
    siteName: platformLabel(platform, url),
    favicon: (() => { try { return getFaviconUrl(new URL(url).hostname.replace('www.', '')); } catch { return undefined; } })(),
    ...(ytId ? { imageUrl: youTubeThumb(ytId) } : {}),
    // Instagram: seed the public cover image instantly (no fetch), like YouTube.
    ...(platform === 'instagram' && instagramCoverUrl(url) ? { imageUrl: instagramCoverUrl(url) } : {}),
    isVideo: isVideoLinkUrl(url),
    loading: true, // background enrichment flag (NOT a blocking spinner)
  };
};

// Extract the 11-char video id from any common YouTube URL shape, or null.
export const youTubeVideoId = (url: string): string | null => {
  try {
    const u = new URL(url);
    const h = u.hostname.replace('www.', '');
    if (h.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
    return u.searchParams.get('v');
  } catch { return null; }
};

// CORS proxy helper for scraping public data. Races two public proxies and takes
// whichever responds first (Promise.any) to cut tail latency; a failing proxy
// just loses the race. Best-effort, keyless.
const fetchViaProxy = async (url: string): Promise<string | null> => {
  const allorigins = async () => {
    const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    const d = await r.json();
    if (!d?.contents) throw new Error('empty');
    return d.contents as string;
  };
  const corsproxy = async () => {
    const r = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`);
    if (!r.ok) throw new Error('bad status');
    const t = await r.text();
    if (!t) throw new Error('empty');
    return t;
  };
  try {
    return await Promise.any([allorigins(), corsproxy()]);
  } catch (e) {
    console.warn('Proxy fetch failed', e);
    return null;
  }
};

export const fetchLinkMetadata = async (url: string): Promise<Partial<LinkCardContent>> => {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.replace('www.', '');

  // 1. YouTube Handler (Real Scrape via noembed)
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    let videoId = '';
    if (hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.slice(1);
    } else {
      videoId = urlObj.searchParams.get('v') || '';
    }

    if (videoId) {
      let title = 'YouTube Video';
      let author = 'YouTube';
      
      try {
        const oembed = await fetch(`https://noembed.com/embed?url=${url}`).then(r => r.json());
        if (oembed && !oembed.error) {
          title = oembed.title;
          author = oembed.author_name;
        }
      } catch (e) {
        console.warn("YouTube oEmbed failed", e);
      }

      return {
        platform: 'youtube',
        siteName: author,
        title: title,
        description: `youtu.be/${videoId}`,
        imageUrl: youTubeThumb(videoId), // hqdefault — always exists, matches the instant seed
        favicon: getFaviconUrl('youtube.com'),
        loading: false
      };
    }
  }

  // 1b. TikTok Handler — official keyless oEmbed (title/author/thumbnail).
  if (hostname.includes('tiktok.com')) {
    let title = 'TikTok Video';
    let author = 'TikTok';
    let thumbnail = '';
    try {
      // Direct first (the endpoint is public); proxy fallback if CORS blocks.
      const direct = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
      const data = direct && !direct.error
        ? direct
        : JSON.parse((await fetchViaProxy(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)) || 'null');
      if (data && !data.error) {
        title = data.title || title;
        author = data.author_name || author;
        thumbnail = data.thumbnail_url || '';
      }
    } catch (e) {
      console.warn('TikTok oEmbed failed', e);
    }
    return {
      platform: 'tiktok',
      siteName: author,
      title,
      description: 'Watch on TikTok',
      imageUrl: thumbnail,
      isVideo: true,
      favicon: getFaviconUrl('tiktok.com'),
      loading: false
    };
  }

  // 2. Pinterest Handler (Proxy RSS Scrape)
  if (hostname.includes('pinterest.com')) {
    const parts = urlObj.pathname.split('/').filter(Boolean);
    const isPin = parts.includes('pin');

    if (!isPin && parts.length >= 2) {
      const username = parts[0];
      const board = parts[1];
      const rssUrl = `https://www.pinterest.com/${username}/${board}.rss`;

      try {
        const rssContent = await fetchViaProxy(rssUrl);
        if (rssContent) {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(rssContent, "text/xml");
          const items = xmlDoc.querySelectorAll("item");
          
          const images: string[] = [];
          items.forEach((item) => {
             const description = item.querySelector("description")?.textContent || "";
             const match = description.match(/src="([^"]+)"/);
             if (match && match[1]) {
               images.push(match[1].replace('236x', '564x'));
             }
          });

          return {
            platform: 'pinterest',
            siteName: 'Pinterest',
            title: xmlDoc.querySelector("title")?.textContent || `${username}/${board}`,
            description: `Board with ${images.length} pins`,
            images: images.slice(0, 5),
            imageUrl: images[0],
            favicon: getFaviconUrl('pinterest.com'),
            loading: false
          };
        }
      } catch (e) {
        console.warn("Pinterest RSS fetch failed", e);
      }
    }

    // Single pin (pinterest.com/pin/...) — og-tag scrape for the pin image.
    // The card shows the image directly (no embed), so a reliable image matters.
    if (isPin) {
      let title = 'Pinterest Pin';
      let image = '';
      try {
        const html = await fetchViaProxy(url);
        if (html) {
          // Attribute-order-agnostic <meta> content extractor (property before or
          // after content, single or double quotes) — Pinterest markup varies.
          const metaContent = (prop: string): string => {
            for (const re of [
              new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
              new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
            ]) {
              const m = html.match(re);
              if (m?.[1]) return m[1];
            }
            return '';
          };
          title = metaContent('og:title') || title;
          image = metaContent('og:image') || metaContent('og:image:src') || '';
        }
      } catch { /* best effort */ }
      return {
        platform: 'pinterest',
        siteName: 'Pinterest',
        title,
        description: 'View on Pinterest',
        imageUrl: image,
        favicon: getFaviconUrl('pinterest.com'),
        loading: false
      };
    }
  }

  // 3. Instagram Handler (Honest Extraction)
  if (hostname.includes('instagram.com')) {
    let title = '';
    let author = '';
    let thumbnail = '';

    // Single fast call: oEmbed for author/caption/thumbnail. (We used to also
    // scrape stats via a slow CORS proxy — dropped: it doubled latency for a
    // best-effort like/comment count. The card stays instant + honest.)
    try {
        const oembed = await fetch(`https://noembed.com/embed?url=${url}`).then(r => r.json());
        if (!oembed.error) {
             title = oembed.title || '';
             author = oembed.author_name || '';
             thumbnail = oembed.thumbnail_url || '';
        }
    } catch (e) { console.warn('IG oEmbed failed', e); }

    // Fallback title if extraction failed completely
    if (!title) title = "Instagram Post";

    return {
        platform: 'instagram',
        siteName: 'Instagram', // Always "Instagram" in header
        author: author.replace('@', ''), // Ensure no @ in "Post by Name"
        title: title, // Caption
        description: 'View on Instagram',
        // Prefer the deterministic public cover; oEmbed thumbnail as fallback.
        imageUrl: instagramCoverUrl(url) || thumbnail,
        isVideo: isVideoLinkUrl(url),
        favicon: getFaviconUrl('instagram.com'),
        loading: false
    };
  }

  // 4. Generic Handler — resolve immediately (no artificial delay).
  return {
    platform: 'generic',
    siteName: hostname.charAt(0).toUpperCase() + hostname.slice(1).split('.')[0],
    title: urlObj.pathname === '/' ? hostname : `${hostname}${urlObj.pathname}`,
    description: url,
    imageUrl: '',
    favicon: getFaviconUrl(hostname),
    loading: false
  };
};
