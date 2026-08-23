// src/media.ts — turn a demo/promo URL into an embeddable player description.
//
// We never host media: musicians and bands already keep their material on
// YouTube, Vimeo, SoundCloud, Spotify, Bandcamp… We only recognise the link
// and describe how to show it (inline player or a plain link card).
export interface Media {
  url: string;
  kind: 'youtube' | 'vimeo' | 'spotify' | 'soundcloud' | 'link';
  /** iframe src for embeddable kinds */
  embed?: string;
  /** iframe height in px (videos use a 16:9 box instead) */
  height?: number;
  /** hostname without www, for the fallback card */
  host: string;
}

export function classifyMedia(raw: string): Media | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const url = u.toString();

  // YouTube: watch?v=, youtu.be/ID, /shorts/ID, /embed/ID
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.searchParams.get('v')) id = u.searchParams.get('v') || '';
    else { const m = u.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,})/); if (m) id = m[1]; }
    if (/^[A-Za-z0-9_-]{6,}$/.test(id)) return { url, kind: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${id}`, host };
  }
  // Vimeo: vimeo.com/123456789
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/\/(?:video\/)?(\d{6,})/);
    if (m) return { url, kind: 'vimeo', embed: `https://player.vimeo.com/video/${m[1]}`, host };
  }
  // Spotify: open.spotify.com/{track|album|artist|playlist|episode|show}/ID
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/\/(?:intl-[a-z]{2}\/)?(track|album|artist|playlist|episode|show)\/([A-Za-z0-9]{10,})/);
    if (m) return { url, kind: 'spotify', embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === 'track' || m[1] === 'episode' ? 152 : 352, host };
  }
  // SoundCloud: the widget accepts any public track/set URL
  if (host === 'soundcloud.com' || host === 'on.soundcloud.com') {
    if (u.pathname.split('/').filter(Boolean).length >= 2) {
      return { url, kind: 'soundcloud', embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%236440fb&auto_play=false&show_comments=false`, height: 166, host };
    }
  }
  return { url, kind: 'link', host };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

/** Server-side HTML for one media item (lazy iframes; plain card for unknown hosts). */
export function mediaHtml(m: Media): string {
  if (m.embed) {
    if (m.kind === 'youtube' || m.kind === 'vimeo') {
      return `<div class="media video"><iframe src="${esc(m.embed)}" title="${esc(m.host)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    }
    return `<div class="media"><iframe src="${esc(m.embed)}" title="${esc(m.host)}" loading="lazy" height="${m.height || 152}" allow="encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  }
  return `<a class="media link" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer nofollow"><span class="play">↗</span><span><span class="t">${esc(m.url)}</span><br><span class="d">${esc(m.host)}</span></span></a>`;
}

/** Shared CSS for .media blocks (public profile + SPA). */
export const MEDIA_CSS = `
  .media { margin-bottom: 12px; border-radius: 12px; overflow: hidden; background: #14131a; }
  .media.video { position: relative; aspect-ratio: 16 / 9; }
  .media.video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .media:not(.video) iframe { display: block; width: 100%; border: 0; }
  .media.link { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--card, #fff); border: 1px solid var(--line, #e6e3dc); text-decoration: none; color: inherit; }
  .media.link .play { width: 36px; height: 36px; border-radius: 50%; background: #14131a; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .media.link .t { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
  .media.link .d { font-size: 12.5px; color: var(--muted, #6f6c64); }
`;

/** Parse a "one URL per line" field into at most `max` valid http(s) URLs. */
export function parseLinks(v: unknown, max = 5): string[] | null {
  if (v === undefined || v === null) return [];
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : null;
  if (!list) return null;
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') return null;
    const s = item.trim();
    if (!s) continue;
    if (s.length > 300) return null;
    const m = classifyMedia(s);
    if (!m) return null;
    out.push(m.url);
    if (out.length >= max) break;
  }
  return out;
}
