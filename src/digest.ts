// src/digest.ts — weekly "near you this week" e-mail for people who don't get
// push (most iPhone users). Runs from the daily cron on Mondays; one mail per
// user with a located profile, only when there is something to say.
import { sendEmail } from './email';
import { haversineKm } from './gigs';
import { Lang, normLang, t } from './i18n';
import { genreLabel } from './genres';
import type { Env } from './types';

export async function sendWeeklyDigests(env: Env, opts: { force?: boolean; now?: Date } = {}): Promise<number> {
  const now = opts.now || new Date();
  if (!opts.force && now.getUTCDay() !== 1) return 0; // Monday
  const { results: users } = await env.DB.prepare(
    `SELECT u.email, u.lang, m.home_city, m.home_lat, m.home_lng, m.travel_radius_km
     FROM users u JOIN musician_details m ON m.owner = u.email
     WHERE u.digest = 1 AND u.banned = 0 AND m.home_lat IS NOT NULL AND m.home_lng IS NOT NULL
       AND (u.digest_sent_at IS NULL OR u.digest_sent_at < datetime('now', '-6 days'))
       AND NOT EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.owner = u.email)
     LIMIT 2000`
  ).all();
  if (!(users as any[]).length) return 0;
  const { results: gigs } = await env.DB.prepare(
    "SELECT id, kind, instrument, venue_city, venue_lat, venue_lng, gig_date, fee_chf, currency FROM gigs WHERE status = 'open' AND created_at > datetime('now', '-7 days') AND venue_lat IS NOT NULL"
  ).all();
  const { results: bands } = await env.DB.prepare(
    "SELECT id, name, kind, genres, home_city, home_lat, home_lng, bookable FROM bands WHERE created_at > datetime('now', '-7 days') AND home_lat IS NOT NULL"
  ).all();
  let sent = 0;
  for (const u of users as any[]) {
    const r = u.travel_radius_km || 30;
    const near = (lat: number, lng: number) => haversineKm(u.home_lat, u.home_lng, lat, lng) <= Math.max(r, 25);
    const g = (gigs as any[]).filter((x) => near(x.venue_lat, x.venue_lng));
    const b = (bands as any[]).filter((x) => near(x.home_lat, x.home_lng));
    const paid = g.filter((x) => x.kind === 'gig'), jams = g.filter((x) => x.kind === 'practice');
    if (!paid.length && !jams.length && !b.length) continue;
    const lang: Lang = normLang(u.lang);
    const city = u.home_city || '';
    const subject = t(lang, {
      en: `This week near ${city}: ${paid.length} gigs, ${jams.length} jams, ${b.length} bands`,
      fr: `Cette semaine près de ${city} : ${paid.length} concerts, ${jams.length} jams, ${b.length} groupes`,
      de: `Diese Woche bei ${city}: ${paid.length} Gigs, ${jams.length} Jams, ${b.length} Bands`,
      it: `Questa settimana vicino a ${city}: ${paid.length} concerti, ${jams.length} jam, ${b.length} gruppi`,
    });
    const line = (x: any) => `• ${x.instrument} · ${x.venue_city}${x.gig_date ? ' · ' + x.gig_date : ''}${x.fee_chf ? ' · ' + (x.currency || 'CHF') + ' ' + x.fee_chf : ''}`;
    const bline = (x: any) => `• ${x.name} · ${JSON.parse(x.genres || '[]').map((s: string) => genreLabel(lang, s)).join(', ')} · ${x.home_city}`;
    const sec = (title: string, items: string[]) => items.length ? `${title}\n${items.slice(0, 5).join('\n')}\n\n` : '';
    const body = sec(t(lang, { en: 'Paid gigs', fr: 'Concerts payés', de: 'Bezahlte Gigs', it: 'Concerti pagati' }), paid.map(line))
      + sec(t(lang, { en: 'Jams', fr: 'Jams', de: 'Jams', it: 'Jam' }), jams.map(line))
      + sec(t(lang, { en: 'New bands', fr: 'Nouveaux groupes', de: 'Neue Bands', it: 'Nuovi gruppi' }), b.map(bline))
      + t(lang, { en: 'Open the app to answer — or turn on alerts to hear about gigs the moment they are posted.', fr: 'Ouvrez l’app pour répondre — ou activez les alertes pour être prévenu dès qu’un concert est publié.', de: 'Öffne die App zum Antworten — oder schalte Alerts ein, um Gigs sofort zu erfahren.', it: 'Apri l’app per rispondere — o attiva gli avvisi per sapere dei concerti appena pubblicati.' })
      + '\n\nhttps://jamwerk.app/?tab=board';
    const ok = await sendEmail(env, u.email, subject, body, { lang });
    await env.DB.prepare("UPDATE users SET digest_sent_at = datetime('now') WHERE email = ?").bind(u.email).run();
    if (ok) sent++;
  }
  return sent;
}
