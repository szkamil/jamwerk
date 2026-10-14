// Response headers shared by every route. The admin page is the only other
// inline script; its bytes are hashed so script-src can stay strict.
import { ADMIN_SCRIPT } from './admin';

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

let csp: string | null = null;

async function contentSecurityPolicy(): Promise<string> {
  if (csp) return csp;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ADMIN_SCRIPT)));
  const hash = b64(digest);
  csp = [
    "default-src 'self'",
    `script-src 'self' 'sha256-${hash}' https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://challenges.cloudflare.com",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://open.spotify.com https://w.soundcloud.com",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  return csp;
}

export async function securityHeaderMap(): Promise<Record<string, string>> {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': await contentSecurityPolicy(),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}
