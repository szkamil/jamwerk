// Bootstraps the ephemeral test D1 database with schema.sql.
import { env } from 'cloudflare:test';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		TEST_SCHEMA_STATEMENTS: string[];
		DB: D1Database;
		JWT_SECRET: string;
	}
}

await env.DB.batch(env.TEST_SCHEMA_STATEMENTS.map((s) => env.DB.prepare(s)));
