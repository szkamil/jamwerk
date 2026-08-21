// src/types.ts
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  // Set to '1' to skip Nominatim lookups (tests); cache reads still work.
  GEOCODE_OFF?: string;
}

export interface SessionUser {
  email: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser | undefined } };
