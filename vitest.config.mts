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
					},
				},
			},
		},
	},
});
