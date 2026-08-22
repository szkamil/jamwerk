// src/types.ts
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  // Set to '1' to skip Nominatim lookups (tests); cache reads still work.
  GEOCODE_OFF?: string;
  // Mailjet credentials (Worker secrets) — from JamWerk's OWN dedicated
  // Mailjet account (login: mailwerk@hotmail.com), NOT the TrustAxis one.
  // See src/email.ts and README "Email". Absent: sends are logged.
  MAILJET_API_KEY?: string;
  MAILJET_SECRET_KEY?: string;
  EMAIL_FROM?: string;
  BASE_URL?: string;
  // Where footer-form feedback is forwarded. Absent: stored in D1 only.
  FEEDBACK_EMAIL?: string;
  // Turnstile widget secret (Worker secret) — see src/turnstile.ts.
  // Absent: bot verification is skipped (tests, local dev).
  TURNSTILE_SECRET_KEY?: string;
  // Web Push VAPID keys (see wrangler.toml note). Absent: pushes are skipped.
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_JWK?: string;
  VAPID_SUBJECT?: string;
}

export interface SessionUser {
  email: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser | undefined } };
