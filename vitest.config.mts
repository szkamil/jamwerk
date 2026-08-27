import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

const here = path.dirname(fileURLToPath(import.meta.url));

// D1's exec() rejects comments and multi-line statements, so split the schema
// into single statements here (Node context) and run them via db.batch() in
// the worker-side setup file. Same approach as the TrustAxis root config.
const schemaStatements = fs
	.readFileSync(path.join(here, 'schema.sql'), 'utf-8')
	.split('\n')
	.filter((line) => !line.trim().startsWith('--'))
	.join('\n')
	.split(';')
	.map((s) => s.trim())
	.filter(Boolean);

export default defineWorkersConfig({
	test: {
		root: here,
		include: ['test/**/*.spec.ts'],
		setupFiles: [path.join(here, 'test/apply-schema.ts')],
		poolOptions: {
			workers: {
				wrangler: { configPath: path.join(here, 'wrangler.toml') },
				miniflare: {
					bindings: {
						TEST_SCHEMA_STATEMENTS: schemaStatements,
						// Never hit Nominatim from tests; specs seed geocode_cache instead.
						GEOCODE_OFF: '1',
						ADMIN_EMAIL: 'admin@example.com',
						// Prod holds these as Worker secrets (not in wrangler.toml); tests get
						// throwaway values. The VAPID pair below is test-only.
						JWT_SECRET: 'test-only-jwt-secret',
						VAPID_PUBLIC_KEY: 'BEXySTx39yeCLrveVmWNTmUw3Yt7DXTblNdBZSOqEUijrDAG1X522TprfPl9iT0WbStZdbQYDJkObAK0FptPWgI',
						VAPID_PRIVATE_JWK: '{"key_ops":["sign"],"ext":true,"kty":"EC","x":"RfJJPHf3J4Iuu95WZY1OZTDdi3sNdNuU10FlI6oRSKM","y":"rDAG1X522TprfPl9iT0WbStZdbQYDJkObAK0FptPWgI","crv":"P-256","d":"lqx_doXiyKD-S2JJ3T3XjarzLqL6pvHNp8ArAgavTZE"}',
					},
				},
			},
		},
	},
});
