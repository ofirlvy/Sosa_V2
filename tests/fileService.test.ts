import { describe, it, expect } from 'vitest';
import { stripBlobUrls, canInlineAsBase64, MAX_IMAGE_BYTES } from '../services/fileService';

// Before persisting, transient blob: preview URLs (optimistic uploads in flight)
// must be stripped so we never save a dead reference — but real Storage URLs and
// all other data must survive untouched, and the input must not be mutated.

describe('stripBlobUrls', () => {
  it('drops blob: URLs, keeps everything else', () => {
    const input = {
      a: { content: { url: 'blob:http://localhost/abc', mediaType: 'image' } },
      b: { content: { url: 'https://x.supabase.co/storage/v1/object/public/media/y.png' } },
      c: { name: 'keep', order: 3, nested: ['blob:zzz', 'ok'] },
    };
    const out = stripBlobUrls(input);
    expect(out.a.content.url).toBe('');
    expect(out.a.content.mediaType).toBe('image');
    expect(out.b.content.url).toBe('https://x.supabase.co/storage/v1/object/public/media/y.png');
    expect(out.c.name).toBe('keep');
    expect(out.c.nested).toEqual(['', 'ok']);
  });

  it('does not mutate the input', () => {
    const input = { a: { url: 'blob:live' } };
    const snapshot = JSON.stringify(input);
    stripBlobUrls(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  // A heavy video whose upload didn't finish must be marked, not silently blanked
  // — otherwise the card is a permanently black box with no explanation.
  it('marks an in-flight media object as uploadPending instead of blanking silently', () => {
    const out: any = stripBlobUrls({ m: { id: '1', type: 'video', url: 'blob:live', uploading: true } });
    expect(out.m.url).toBe('');
    expect(out.m.uploadPending).toBe(true);
  });

  it('clears uploadPending once the real Storage URL has landed', () => {
    const out: any = stripBlobUrls({ m: { id: '1', type: 'video', url: 'https://x/y.mp4', uploadPending: true } });
    expect(out.m.url).toBe('https://x/y.mp4');
    expect(out.m.uploadPending).toBeUndefined();
  });
});

// The tree is ONE JSON blob: inlining a big asset as base64 breaks EVERY later
// save. Only small files may ever fall back to base64.
describe('canInlineAsBase64', () => {
  it('allows small files and refuses anything above the image limit', () => {
    expect(canInlineAsBase64(50_000)).toBe(true);
    expect(canInlineAsBase64(MAX_IMAGE_BYTES)).toBe(true);
    expect(canInlineAsBase64(MAX_IMAGE_BYTES + 1)).toBe(false);
    expect(canInlineAsBase64(100 * 1024 * 1024)).toBe(false); // a heavy video
  });
});
