import { describe, it, expect } from 'vitest';
import { instagramShortcode, instagramCoverUrl, isVideoLinkUrl } from '../services/linkService';

describe('instagramShortcode', () => {
  it('extracts the shortcode from post / reel / tv URLs', () => {
    expect(instagramShortcode('https://www.instagram.com/p/CxYz123_-/')).toBe('CxYz123_-');
    expect(instagramShortcode('https://instagram.com/reel/AbC987/?hl=en')).toBe('AbC987');
    expect(instagramShortcode('https://www.instagram.com/tv/Zz00/')).toBe('Zz00');
    expect(instagramShortcode('https://www.instagram.com/brand/reel/QqQq/')).toBe('QqQq'); // with username
    expect(instagramShortcode('https://www.instagram.com/someuser/')).toBe('');
  });
});

describe('instagramCoverUrl', () => {
  it('builds the public /media/?size=l cover URL', () => {
    expect(instagramCoverUrl('https://www.instagram.com/p/CxYz123/')).toBe('https://www.instagram.com/p/CxYz123/media/?size=l');
    expect(instagramCoverUrl('https://www.instagram.com/reel/AbC987/')).toBe('https://www.instagram.com/p/AbC987/media/?size=l');
    expect(instagramCoverUrl('https://example.com/x')).toBe('');
  });
});

describe('isVideoLinkUrl', () => {
  it('is true for IG reels/tv and all TikTok, false for IG posts', () => {
    expect(isVideoLinkUrl('https://www.instagram.com/reel/AbC987/')).toBe(true);
    expect(isVideoLinkUrl('https://www.instagram.com/tv/Zz00/')).toBe(true);
    expect(isVideoLinkUrl('https://www.instagram.com/p/CxYz123/')).toBe(false);
    expect(isVideoLinkUrl('https://www.tiktok.com/@u/video/123')).toBe(true);
    expect(isVideoLinkUrl('https://example.com/x')).toBe(false);
  });
});
