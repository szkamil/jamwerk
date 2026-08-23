// src/places-api.ts — city typeahead.
//
//   GET /places?q=gen   → { places: [{ name, region, country, lat, lng }] }
//
// Curated list first (src/places.ts, instant, multilingual aliases); when it
// yields fewer than 5 hits and the query has 3+ chars, Photon (komoot's
// OSM geocoder, built for autocomplete) fills in, biased to Geneva and
// limited to CH/FR/DE/IT/AT places. Results are suggestions the user picks
// from — nothing is stored until they do.
import { Hono } from 'hono';
import { searchPlaces } from './places';
import { rateLimited, clientIp } from './ratelimit';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();
const ALLOWED = new Set(['CH', 'FR', 'DE', 'IT', 'AT']);

app.get('/', async (c) => {
  const q = (c.req.query('q') || '').trim().slice(0, 60);
  if (q.length < 2) return c.json({ places: [] });
  const out: Array<{ name: string; region: string; country: string; lat: number; lng: number }> =
    searchPlaces(q, 6).map((p) => ({ name: p.n, region: p.r, country: p.c as string, lat: p.lat, lng: p.lng }));
  if (out.length < 5 && q.length >= 3 && c.env.GEOCODE_OFF !== '1') {
    if (await rateLimited(c.env, clientIp(c), 'places', 60, 10)) return c.json({ places: out });
    try {
      const url = 'https://photon.komoot.io/api/?limit=6&lang=fr&lat=46.2&lon=6.14&q=' + encodeURIComponent(q);
      const res = await fetch(url, { headers: { 'User-Agent': 'JamWerk/0.1 (https://jamwerk.app)' }, signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = (await res.json()) as { features?: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, string> }> };
        for (const f of data.features || []) {
          const pr = f.properties || {};
          if (pr.osm_key !== 'place' || !ALLOWED.has(pr.countrycode)) continue;
          if (!['city', 'town', 'village', 'municipality', 'suburb', 'hamlet', 'locality'].includes(pr.osm_value)) continue;
          const name = pr.name; if (!name) continue;
          if (out.some((o) => o.name.toLowerCase() === name.toLowerCase())) continue;
          out.push({ name, region: pr.state || pr.county || '', country: pr.countrycode, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });
          if (out.length >= 8) break;
        }
      }
    } catch { /* suggestions are best-effort */ }
  }
  return c.json({ places: out });
});

export default app;
