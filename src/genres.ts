// src/genres.ts — fixed genre list. Slugs are stored; labels are per language.
// Free text typed before this list existed is mapped onto slugs by normGenres().
export const GENRES = [
  'rock', 'pop', 'indie', 'metal', 'punk', 'blues', 'jazz', 'swing', 'funk', 'soul', 'rnb', 'hiphop',
  'reggae', 'ska', 'latin', 'samba_bossa', 'folk', 'country', 'chanson', 'classical', 'contemporary',
  'electronic', 'gospel', 'world',
] as const;
export type Genre = (typeof GENRES)[number];

export const GENRE_LABELS: Record<Genre, { en: string; fr: string; de: string; it: string }> = {
  rock: { en: 'rock', fr: 'rock', de: 'Rock', it: 'rock' },
  pop: { en: 'pop', fr: 'pop', de: 'Pop', it: 'pop' },
  indie: { en: 'indie', fr: 'indie', de: 'Indie', it: 'indie' },
  metal: { en: 'metal', fr: 'metal', de: 'Metal', it: 'metal' },
  punk: { en: 'punk', fr: 'punk', de: 'Punk', it: 'punk' },
  blues: { en: 'blues', fr: 'blues', de: 'Blues', it: 'blues' },
  jazz: { en: 'jazz', fr: 'jazz', de: 'Jazz', it: 'jazz' },
  swing: { en: 'swing', fr: 'swing', de: 'Swing', it: 'swing' },
  funk: { en: 'funk', fr: 'funk', de: 'Funk', it: 'funk' },
  soul: { en: 'soul', fr: 'soul', de: 'Soul', it: 'soul' },
  rnb: { en: 'R&B', fr: 'R&B', de: 'R&B', it: 'R&B' },
  hiphop: { en: 'hip-hop / rap', fr: 'hip-hop / rap', de: 'Hip-Hop / Rap', it: 'hip-hop / rap' },
  reggae: { en: 'reggae', fr: 'reggae', de: 'Reggae', it: 'reggae' },
  ska: { en: 'ska', fr: 'ska', de: 'Ska', it: 'ska' },
  latin: { en: 'latin', fr: 'latino', de: 'Latin', it: 'latino' },
  samba_bossa: { en: 'samba / bossa nova', fr: 'samba / bossa nova', de: 'Samba / Bossa Nova', it: 'samba / bossa nova' },
  folk: { en: 'folk', fr: 'folk', de: 'Folk', it: 'folk' },
  country: { en: 'country', fr: 'country', de: 'Country', it: 'country' },
  chanson: { en: 'chanson', fr: 'chanson', de: 'Chanson', it: 'chanson' },
  classical: { en: 'classical', fr: 'classique', de: 'Klassik', it: 'classica' },
  contemporary: { en: 'contemporary', fr: 'contemporain', de: 'Zeitgenössisch', it: 'contemporanea' },
  electronic: { en: 'electronic', fr: 'électro', de: 'Elektro', it: 'elettronica' },
  gospel: { en: 'gospel', fr: 'gospel', de: 'Gospel', it: 'gospel' },
  world: { en: 'world music', fr: 'musiques du monde', de: 'Weltmusik', it: 'world music' },
};

const SYNONYMS: Record<string, Genre | Genre[]> = {
  classic: 'classical', classique: 'classical', klassik: 'classical', classica: 'classical', klassisch: 'classical',
  contemporaine: 'contemporary', contemporain: 'contemporary', contemporanea: 'contemporary', zeitgenossisch: 'contemporary',
  'pop-rock': ['pop', 'rock'], poprock: ['pop', 'rock'], 'pop rock': ['pop', 'rock'],
  electro: 'electronic', electronique: 'electronic', elektro: 'electronic', elettronica: 'electronic', techno: 'electronic', house: 'electronic', edm: 'electronic',
  rap: 'hiphop', 'hip-hop': 'hiphop', 'hip hop': 'hiphop', hiphop: 'hiphop',
  'r&b': 'rnb', rnb: 'rnb', 'r and b': 'rnb',
  samba: 'samba_bossa', 'bossa nova': 'samba_bossa', bossa: 'samba_bossa', bossanova: 'samba_bossa', mpb: 'samba_bossa', brazilian: 'samba_bossa', bresilien: 'samba_bossa',
  latino: 'latin', salsa: 'latin', cumbia: 'latin',
  'heavy metal': 'metal', hardrock: 'metal', 'hard rock': 'metal',
  'musiques du monde': 'world', weltmusik: 'world', 'world music': 'world',
  variete: 'chanson', 'variété': 'chanson', 'chanson francaise': 'chanson',
  alternative: 'indie', alt: 'indie',
};

const strip = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();

/** Map any list of genre strings (slugs, labels, legacy free text) to known slugs, de-duplicated; unknown entries are dropped. */
export function normGenres(list: unknown): Genre[] {
  if (!Array.isArray(list)) return [];
  const out: Genre[] = [];
  const push = (g: Genre) => { if (!out.includes(g)) out.push(g); };
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const k = strip(raw);
    if ((GENRES as readonly string[]).includes(k)) { push(k as Genre); continue; }
    const syn = SYNONYMS[k];
    if (syn) { (Array.isArray(syn) ? syn : [syn]).forEach(push); continue; }
    // match a label in any language ("classique", "Klassik")
    const byLabel = (Object.keys(GENRE_LABELS) as Genre[]).find((g) => Object.values(GENRE_LABELS[g]).some((l) => strip(l) === k));
    if (byLabel) push(byLabel);
  }
  return out.slice(0, 10);
}

export function genreLabel(lang: 'en' | 'fr' | 'de' | 'it', slug: string): string {
  const l = (GENRE_LABELS as Record<string, { en: string; fr: string; de: string; it: string }>)[slug];
  return l ? l[lang] : slug.replace(/_/g, ' ');
}
