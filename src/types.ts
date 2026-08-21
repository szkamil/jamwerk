// src/types.ts
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export interface SessionUser {
  email: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser | undefined } };
