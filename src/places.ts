// src/places.ts — curated place list for instant, typo-proof city picking.
//
// Free-text city names were the weakest link: a typo ("Genve") or a short
// ambiguous name ("Saint-Julien") silently produced no / wrong coordinates,
// and the listing then never matched any radius search or alert. The fix is
// a pick-list: this bundled list answers instantly (and offline) for the
// places 95% of users mean — Grand Genève, Romandie, the French border zone,
// the big Swiss cities — with multilingual aliases (Genf, Geneva, Ginebra…).
// Anything else goes through /places (Photon, OSM-based) and is confirmed
// by the user before it is stored.
export interface Place {
  /** canonical display name */
  n: string;
  /** region: Swiss canton code or French département */
  r: string;
  /** ISO country */
  c: 'CH' | 'FR';
  lat: number;
  lng: number;
  /** alternative spellings / languages */
  a?: string[];
}

export const PLACES: Place[] = [
  // Genève
  { n: 'Genève', r: 'GE', c: 'CH', lat: 46.2044, lng: 6.1432, a: ['Geneva', 'Genf', 'Ginebra', 'Ginevra', 'Geneve'] },
  { n: 'Carouge', r: 'GE', c: 'CH', lat: 46.1810, lng: 6.1390 },
  { n: 'Lancy', r: 'GE', c: 'CH', lat: 46.1896, lng: 6.1196 },
  { n: 'Vernier', r: 'GE', c: 'CH', lat: 46.2176, lng: 6.0850 },
  { n: 'Meyrin', r: 'GE', c: 'CH', lat: 46.2340, lng: 6.0800 },
  { n: 'Onex', r: 'GE', c: 'CH', lat: 46.1850, lng: 6.1000 },
  { n: 'Thônex', r: 'GE', c: 'CH', lat: 46.1960, lng: 6.1990, a: ['Thonex'] },
  { n: 'Chêne-Bougeries', r: 'GE', c: 'CH', lat: 46.1950, lng: 6.1860, a: ['Chene-Bougeries'] },
  { n: 'Versoix', r: 'GE', c: 'CH', lat: 46.2840, lng: 6.1620 },
  { n: 'Plan-les-Ouates', r: 'GE', c: 'CH', lat: 46.1680, lng: 6.1170 },
  { n: 'Bernex', r: 'GE', c: 'CH', lat: 46.1770, lng: 6.0750 },
  { n: 'Le Grand-Saconnex', r: 'GE', c: 'CH', lat: 46.2330, lng: 6.1220, a: ['Grand-Saconnex'] },
  // Vaud
  { n: 'Nyon', r: 'VD', c: 'CH', lat: 46.3832, lng: 6.2396 },
  { n: 'Gland', r: 'VD', c: 'CH', lat: 46.4200, lng: 6.2700 },
  { n: 'Rolle', r: 'VD', c: 'CH', lat: 46.4580, lng: 6.3380 },
  { n: 'Morges', r: 'VD', c: 'CH', lat: 46.5110, lng: 6.4980 },
  { n: 'Lausanne', r: 'VD', c: 'CH', lat: 46.5197, lng: 6.6323 },
  { n: 'Renens', r: 'VD', c: 'CH', lat: 46.5390, lng: 6.5880 },
  { n: 'Pully', r: 'VD', c: 'CH', lat: 46.5100, lng: 6.6610 },
  { n: 'Vevey', r: 'VD', c: 'CH', lat: 46.4628, lng: 6.8430 },
  { n: 'Montreux', r: 'VD', c: 'CH', lat: 46.4312, lng: 6.9107 },
  { n: 'Aigle', r: 'VD', c: 'CH', lat: 46.3170, lng: 6.9700 },
  { n: 'Yverdon-les-Bains', r: 'VD', c: 'CH', lat: 46.7785, lng: 6.6412, a: ['Yverdon'] },
  // Fribourg / Neuchâtel / Valais / Jura
  { n: 'Fribourg', r: 'FR', c: 'CH', lat: 46.8065, lng: 7.1620, a: ['Freiburg', 'Friburgo'] },
  { n: 'Bulle', r: 'FR', c: 'CH', lat: 46.6190, lng: 7.0570 },
  { n: 'Neuchâtel', r: 'NE', c: 'CH', lat: 46.9900, lng: 6.9310, a: ['Neuchatel', 'Neuenburg'] },
  { n: 'La Chaux-de-Fonds', r: 'NE', c: 'CH', lat: 47.1035, lng: 6.8328, a: ['Chaux-de-Fonds'] },
  { n: 'Sion', r: 'VS', c: 'CH', lat: 46.2331, lng: 7.3606, a: ['Sitten'] },
  { n: 'Sierre', r: 'VS', c: 'CH', lat: 46.2920, lng: 7.5350, a: ['Siders'] },
  { n: 'Martigny', r: 'VS', c: 'CH', lat: 46.1020, lng: 7.0720 },
  { n: 'Monthey', r: 'VS', c: 'CH', lat: 46.2540, lng: 6.9540 },
  { n: 'Zermatt', r: 'VS', c: 'CH', lat: 46.0207, lng: 7.7491 },
  { n: 'Delémont', r: 'JU', c: 'CH', lat: 47.3640, lng: 7.3450, a: ['Delemont', 'Delsberg'] },
  // Deutschschweiz / Ticino / Graubünden
  { n: 'Bern', r: 'BE', c: 'CH', lat: 46.9480, lng: 7.4474, a: ['Berne', 'Berna'] },
  { n: 'Thun', r: 'BE', c: 'CH', lat: 46.7580, lng: 7.6280, a: ['Thoune'] },
  { n: 'Biel/Bienne', r: 'BE', c: 'CH', lat: 47.1368, lng: 7.2467, a: ['Biel', 'Bienne'] },
  { n: 'Basel', r: 'BS', c: 'CH', lat: 47.5596, lng: 7.5886, a: ['Bâle', 'Bale', 'Basilea'] },
  { n: 'Zürich', r: 'ZH', c: 'CH', lat: 47.3769, lng: 8.5417, a: ['Zurich', 'Zurigo'] },
  { n: 'Winterthur', r: 'ZH', c: 'CH', lat: 47.4990, lng: 8.7240 },
  { n: 'Luzern', r: 'LU', c: 'CH', lat: 47.0502, lng: 8.3093, a: ['Lucerne', 'Lucerna'] },
  { n: 'St. Gallen', r: 'SG', c: 'CH', lat: 47.4245, lng: 9.3767, a: ['Sankt Gallen', 'Saint-Gall', 'St Gallen', 'San Gallo'] },
  { n: 'Lugano', r: 'TI', c: 'CH', lat: 46.0037, lng: 8.9511 },
  { n: 'Bellinzona', r: 'TI', c: 'CH', lat: 46.1950, lng: 9.0290 },
  { n: 'Locarno', r: 'TI', c: 'CH', lat: 46.1700, lng: 8.7960 },
  { n: 'Chur', r: 'GR', c: 'CH', lat: 46.8508, lng: 9.5320, a: ['Coire', 'Coira'] },
  { n: 'Zug', r: 'ZG', c: 'CH', lat: 47.1662, lng: 8.5154, a: ['Zoug'] },
  { n: 'Aarau', r: 'AG', c: 'CH', lat: 47.3925, lng: 8.0442 },
  { n: 'Olten', r: 'SO', c: 'CH', lat: 47.3500, lng: 7.9030 },
  { n: 'Solothurn', r: 'SO', c: 'CH', lat: 47.2080, lng: 7.5370, a: ['Soleure', 'Soletta'] },
  { n: 'Schaffhausen', r: 'SH', c: 'CH', lat: 47.6970, lng: 8.6340, a: ['Schaffhouse'] },
  // France — Grand Genève & Haute-Savoie / Ain
  { n: 'Annemasse', r: '74', c: 'FR', lat: 46.1934, lng: 6.2342 },
  { n: 'Saint-Julien-en-Genevois', r: '74', c: 'FR', lat: 46.1440, lng: 6.0810, a: ['Saint-Julien', 'St-Julien', 'St Julien'] },
  { n: 'Ferney-Voltaire', r: '01', c: 'FR', lat: 46.2580, lng: 6.1080, a: ['Ferney'] },
  { n: 'Gex', r: '01', c: 'FR', lat: 46.3330, lng: 6.0580 },
  { n: 'Saint-Genis-Pouilly', r: '01', c: 'FR', lat: 46.2440, lng: 6.0240, a: ['Saint-Genis', 'St-Genis'] },
  { n: 'Divonne-les-Bains', r: '01', c: 'FR', lat: 46.3570, lng: 6.1370, a: ['Divonne'] },
  { n: 'Valserhône', r: '01', c: 'FR', lat: 46.1080, lng: 5.8260, a: ['Bellegarde-sur-Valserine', 'Bellegarde', 'Valserhone'] },
  { n: 'Thonon-les-Bains', r: '74', c: 'FR', lat: 46.3710, lng: 6.4790, a: ['Thonon'] },
  { n: 'Évian-les-Bains', r: '74', c: 'FR', lat: 46.4010, lng: 6.5880, a: ['Evian', 'Évian'] },
  { n: 'Douvaine', r: '74', c: 'FR', lat: 46.3060, lng: 6.3030 },
  { n: 'Gaillard', r: '74', c: 'FR', lat: 46.1850, lng: 6.2060 },
  { n: 'Ville-la-Grand', r: '74', c: 'FR', lat: 46.2000, lng: 6.2500 },
  { n: 'Archamps', r: '74', c: 'FR', lat: 46.1330, lng: 6.1220 },
  { n: 'Bonneville', r: '74', c: 'FR', lat: 46.0790, lng: 6.4060 },
  { n: 'Cluses', r: '74', c: 'FR', lat: 46.0600, lng: 6.5790 },
  { n: 'Sallanches', r: '74', c: 'FR', lat: 45.9360, lng: 6.6320 },
  { n: 'Chamonix-Mont-Blanc', r: '74', c: 'FR', lat: 45.9237, lng: 6.8694, a: ['Chamonix'] },
  { n: 'Annecy', r: '74', c: 'FR', lat: 45.8992, lng: 6.1294 },
  { n: 'Chambéry', r: '73', c: 'FR', lat: 45.5646, lng: 5.9178, a: ['Chambery'] },
  { n: 'Grenoble', r: '38', c: 'FR', lat: 45.1885, lng: 5.7245 },
  { n: 'Lyon', r: '69', c: 'FR', lat: 45.7640, lng: 4.8357 },
];

/** Accent/case/punctuation-insensitive key: "Genève" → "geneve", "St-Julien" → "st julien". */
export function normPlace(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-_./]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Exact match on name or alias (normalised). */
export function findPlace(q: string): Place | null {
  const k = normPlace(q);
  if (!k) return null;
  for (const p of PLACES) {
    if (normPlace(p.n) === k) return p;
    if (p.a && p.a.some((x) => normPlace(x) === k)) return p;
  }
  return null;
}

/** Prefix/word matches for a typeahead, best first. */
export function searchPlaces(q: string, limit = 6): Place[] {
  const k = normPlace(q);
  if (!k) return [];
  const scored: Array<[number, Place]> = [];
  for (const p of PLACES) {
    const names = [p.n, ...(p.a || [])].map(normPlace);
    let best = 0;
    for (const n of names) {
      if (n === k) best = Math.max(best, 3);
      else if (n.startsWith(k)) best = Math.max(best, 2);
      else if (n.split(' ').some((w) => w.startsWith(k))) best = Math.max(best, 1);
    }
    if (best) scored.push([best, p]);
  }
  return scored.sort((x, y) => y[0] - x[0] || x[1].n.localeCompare(y[1].n)).slice(0, limit).map((x) => x[1]);
}

/** Compact JSON for the client bundle. */
export const PLACES_JSON = JSON.stringify(PLACES.map((p) => [p.n, p.r, p.c, p.lat, p.lng, p.a || []]));
