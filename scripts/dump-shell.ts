import { writeFileSync } from 'node:fs';
import { PAGE } from '../src/ui';
import { fnv1a } from '../src/fnv';

const cssMatch = PAGE.match(/<style>([\s\S]*?)<\/style>/);
const jsMatch = PAGE.match(/<script>([\s\S]*?)<\/script>/);
if (!cssMatch || !jsMatch) throw new Error('PAGE is missing a style or script block');
const css = cssMatch[1];
const js = jsMatch[1];
writeFileSync('/tmp/jamwerk-shell.json', JSON.stringify({
  css,
  js,
  cssHash: fnv1a(css),
  jsHash: fnv1a(js),
}));
