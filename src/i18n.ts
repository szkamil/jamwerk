// src/i18n.ts — four-language support (Swiss market + English).
// Server-side messages use t(lang, {...}) inline; the client UI carries its
// own dictionary in src/ui.ts. Per-user language lives in users.lang.
export type Lang = 'en' | 'fr' | 'de' | 'it';

export const LANGS: Lang[] = ['en', 'fr', 'de', 'it'];

export function normLang(x: unknown): Lang {
  return LANGS.includes(x as Lang) ? (x as Lang) : 'en';
}

/** Best-supported language from an Accept-Language header. */
export function pickLang(header: string | null | undefined): Lang {
  for (const part of (header || '').split(',')) {
    const code = part.split(';')[0].trim().slice(0, 2).toLowerCase();
    if (LANGS.includes(code as Lang)) return code as Lang;
  }
  return 'en';
}

export function t(lang: Lang, m: { en: string; fr: string; de: string; it: string }): string {
  return m[lang] ?? m.en;
}
