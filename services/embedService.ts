// Live social embeds without any API keys — the official, ToS-compliant embed
// routes each platform ships for the open web:
//   Instagram : blockquote.instagram-media + instagram.com/embed.js (public posts)
//   TikTok    : official keyless oEmbed (tiktok.com/oembed) + tiktok.com/embed.js
//   Pinterest : <a data-pin-do="embedPin"> + assets.pinterest.com/js/pinit.js
//   YouTube   : handled separately (plain iframe — see LinkCard)
// mountEmbed(el, platform, url) injects the markup and triggers the platform's
// hydration hook. Scripts are loaded once (promise-cached singleton).

declare global {
  interface Window {
    instgrm?: { Embeds?: { process: () => void } };
    PinUtils?: { build?: (el?: HTMLElement) => void };
    tiktokEmbed?: { lib?: { render?: (els?: HTMLElement[]) => void } };
  }
}

export type EmbeddablePlatform = 'instagram' | 'tiktok' | 'pinterest';

export const isEmbeddablePlatform = (platform?: string): platform is EmbeddablePlatform =>
  platform === 'instagram' || platform === 'tiktok' || platform === 'pinterest';

// --- Script loader (one promise per src, reused forever) ---
const scriptPromises = new Map<string, Promise<void>>();

export const ensureScript = (src: string): Promise<void> => {
  const existing = scriptPromises.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromises.delete(src); reject(new Error(`Failed to load ${src}`)); };
    document.body.appendChild(s);
  });
  scriptPromises.set(src, p);
  return p;
};

const IG_EMBED_JS = 'https://www.instagram.com/embed.js';
const TIKTOK_EMBED_JS = 'https://www.tiktok.com/embed.js';
const PINTEREST_PINIT_JS = 'https://assets.pinterest.com/js/pinit.js';

// --- TikTok oEmbed (official, keyless) ---
export interface TikTokOEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  html?: string; // blockquote markup (references embed.js)
}

export const fetchTikTokOEmbed = async (url: string): Promise<TikTokOEmbed | null> => {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && !data.error ? data as TikTokOEmbed : null;
  } catch {
    return null; // CORS/network — caller falls back (e.g. via proxy in linkService)
  }
};

// --- Embed markup builders (pure) ---
export const instagramEmbedHtml = (url: string): string =>
  `<blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14" style="margin:0 auto; width:100%; min-width:unset;"></blockquote>`;

export const tiktokEmbedHtml = (url: string, videoId?: string): string => {
  // Canonical blockquote shape TikTok's embed.js hydrates.
  const id = videoId || url.split('/video/')[1]?.split(/[/?#]/)[0] || '';
  return `<blockquote class="tiktok-embed" cite="${url}" data-video-id="${id}" style="margin:0 auto; max-width:100%; min-width:unset;"><section></section></blockquote>`;
};

export const pinterestEmbedHtml = (url: string): string =>
  `<a data-pin-do="embedPin" data-pin-width="medium" href="${url}"></a>`;

/**
 * Inject a live embed for `url` into `el` and hydrate it. Idempotent per call —
 * replaces el's content. Returns once the platform script has loaded (hydration
 * itself is async inside the platform lib).
 */
export const mountEmbed = async (el: HTMLElement, platform: EmbeddablePlatform, url: string): Promise<void> => {
  if (platform === 'instagram') {
    el.innerHTML = instagramEmbedHtml(url);
    await ensureScript(IG_EMBED_JS);
    window.instgrm?.Embeds?.process();
    return;
  }
  if (platform === 'tiktok') {
    el.innerHTML = tiktokEmbedHtml(url);
    await ensureScript(TIKTOK_EMBED_JS);
    // TikTok's embed.js scans on load; re-render hook for late-mounted nodes.
    window.tiktokEmbed?.lib?.render?.([el]);
    return;
  }
  // pinterest
  el.innerHTML = pinterestEmbedHtml(url);
  await ensureScript(PINTEREST_PINIT_JS);
  window.PinUtils?.build?.(el);
};
