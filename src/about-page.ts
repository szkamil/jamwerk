// src/about-page.ts — /about: the story, what JamWerk is (and that it's free),
// how to reach us, and the legal boilerplate. Server-rendered, four languages.
import { Hono } from 'hono';
import { WAVE_SVG, NOTES_LAYER } from './ui';
import { pickLang, t, Lang } from './i18n';
import type { AppEnv } from './types';
import { esc, PAGE_CSS } from './profile-page';

const CSS = `
  main { padding: 20px 20px 48px; }
  .lead { font-size: 18px; line-height: 1.55; color: #1b1a16; }
  h2 { margin-top: 26px; }
  p { margin: 0 0 12px; font-size: 15.5px; line-height: 1.55; color: #3a382f; }
  ul { margin: 0 0 12px 18px; padding: 0; font-size: 15.5px; color: #3a382f; }
  li { margin-bottom: 5px; }
  .btn { display: inline-block; background: var(--accent); color: #fff !important; text-decoration: none; padding: 11px 18px; border-radius: 10px; font-weight: 700; font-size: 14.5px; margin: 6px 8px 6px 0; }
  .btn.ghost { background: var(--card); color: var(--ink) !important; border: 1px solid var(--line); }
  .legal { font-size: 13.5px; color: var(--muted); }
  .legal p { font-size: 13.5px; color: var(--muted); }
  .todo { background: #fff7d6; border: 1px solid #f0dc8a; border-radius: 8px; padding: 2px 6px; }
  @media (max-width: 640px) { .btn { display: block; text-align: center; margin: 8px 0; } }
`;

type S = { en: string; fr: string; de: string; it: string };
const L = (lang: Lang, s: S) => t(lang, s);

const aboutPage = new Hono<AppEnv>();

aboutPage.get('/', async (c) => {
  const forced = c.req.query('lang');
  const lang = (forced && ['en', 'fr', 'de', 'it'].includes(forced) ? forced : pickLang(c.req.header('Accept-Language'))) as Lang;
  const year = new Date().getFullYear();
  const title = L(lang, { en: 'About JamWerk', fr: 'À propos de JamWerk', de: 'Über JamWerk', it: 'Informazioni su JamWerk' });

  const story = L(lang, {
    en: `JamWerk started in Geneva with a simple observation: the musicians are all here — in rehearsal rooms, conservatoires, bars and living rooms — but finding each other still happens by luck. A bandleader loses a bass player two days before a wedding. A drummer new in town has nobody to play with on a Tuesday night. A soul band with three sets ready has no way to be found by the people who would book them.

So we built the place where those paths cross. Musicians say what they play and what they're looking for. Bands present themselves with their demos. Jam groups say when they meet. Paid gigs show the fee up front. And everyone can simply write to each other.

It is made for the Lake Geneva region first — both sides of the border — and grows wherever musicians want it.`,
    fr: `JamWerk est né à Genève d'un constat simple : les musiciens sont tous là — dans les locaux de répétition, les conservatoires, les bars et les salons — mais se trouver reste une question de chance. Un chef de groupe perd son bassiste deux jours avant un mariage. Un batteur fraîchement arrivé n'a personne avec qui jouer un mardi soir. Un groupe de soul avec trois sets prêts n'a aucun moyen d'être trouvé par ceux qui voudraient le réserver.

Alors on a construit l'endroit où ces chemins se croisent. Les musiciens disent ce qu'ils jouent et ce qu'ils cherchent. Les groupes se présentent avec leurs démos. Les groupes de jam disent quand ils se retrouvent. Les concerts payés affichent le cachet d'avance. Et tout le monde peut simplement s'écrire.

C'est pensé d'abord pour le bassin lémanique — des deux côtés de la frontière — et ça grandit partout où des musiciens en veulent.`,
    de: `JamWerk ist in Genf aus einer einfachen Beobachtung entstanden: Die Musiker:innen sind alle da — in Proberäumen, Konservatorien, Bars und Wohnzimmern — aber sich zu finden bleibt Glückssache. Eine Bandleaderin verliert zwei Tage vor einer Hochzeit ihren Bassisten. Ein neu zugezogener Schlagzeuger hat an einem Dienstagabend niemanden zum Spielen. Eine Soul-Band mit drei fertigen Sets wird von denen, die sie buchen würden, nie gefunden.

Also haben wir den Ort gebaut, an dem sich diese Wege kreuzen. Musiker:innen sagen, was sie spielen und was sie suchen. Bands stellen sich mit ihren Demos vor. Jam-Gruppen sagen, wann sie sich treffen. Bezahlte Gigs zeigen die Gage vorab. Und alle können sich einfach schreiben.

Gedacht ist es zuerst für die Genferseeregion — auf beiden Seiten der Grenze — und es wächst überall dort, wo Musiker:innen es wollen.`,
    it: `JamWerk è nato a Ginevra da un'osservazione semplice: i musicisti ci sono tutti — nelle sale prove, nei conservatori, nei bar e nei salotti — ma trovarsi resta una questione di fortuna. Un capobanda perde il bassista due giorni prima di un matrimonio. Un batterista appena arrivato non ha nessuno con cui suonare il martedì sera. Una band soul con tre set pronti non ha modo di farsi trovare da chi vorrebbe prenotarla.

Così abbiamo costruito il posto in cui queste strade si incrociano. I musicisti dicono cosa suonano e cosa cercano. I gruppi si presentano con le loro demo. I gruppi jam dicono quando si trovano. I concerti pagati mostrano il cachet in anticipo. E tutti possono semplicemente scriversi.

È pensato prima di tutto per la regione del Lemano — da entrambi i lati del confine — e cresce ovunque i musicisti lo vogliano.`,
  });

  const paras = (txt: string) => txt.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('');

  return c.html(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | JamWerk</title>
<meta name="description" content="${esc(L(lang, { en: 'Why JamWerk exists, what it is, how to reach us, and the legal notice.', fr: 'Pourquoi JamWerk existe, ce que c’est, comment nous joindre, et les mentions légales.', de: 'Warum es JamWerk gibt, was es ist, wie du uns erreichst, und das Impressum.', it: 'Perché esiste JamWerk, cos’è, come contattarci e le note legali.' }))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<meta name="theme-color" content="#14131a">
<style>${PAGE_CSS}${CSS}</style>
</head>
<body>
${NOTES_LAYER}
<header>
  ${WAVE_SVG}
  <div class="inner">
    <a class="back" href="/">&larr; JamWerk</a>
    <div class="hero"><div><h1 class="display">${esc(title)}</h1>
      <div class="sub">${L(lang, { en: 'gigs · jams · bands — free for musicians', fr: 'concerts · jams · groupes — gratuit pour les musiciens', de: 'Gigs · Jams · Bands — gratis für Musiker:innen', it: 'concerti · jam · band — gratis per i musicisti' })}</div></div></div>
    <div class="pills"><a class="pill" href="/about?lang=en" style="text-decoration:none">EN</a><a class="pill" href="/about?lang=fr" style="text-decoration:none">FR</a><a class="pill" href="/about?lang=de" style="text-decoration:none">DE</a><a class="pill" href="/about?lang=it" style="text-decoration:none">IT</a></div>
  </div>
</header>
<main>
  <p class="lead">${L(lang, { en: 'A place where local musicians, bands and the people who book them can find each other — and talk.', fr: 'Un endroit où les musiciens du coin, les groupes et ceux qui les réservent peuvent se trouver — et se parler.', de: 'Ein Ort, an dem Musiker:innen, Bands und die Leute, die sie buchen, sich finden — und miteinander reden.', it: 'Un posto dove musicisti, gruppi e chi li prenota possono trovarsi — e parlarsi.' })}</p>
  <div style="margin: 6px 0 4px;">
    <a class="btn" href="/?feedback=1">${L(lang, { en: 'Send feedback or a question', fr: 'Envoyer un retour ou une question', de: 'Feedback oder Frage senden', it: 'Invia un feedback o una domanda' })}</a>
    <a class="btn ghost" href="/?tab=help">${L(lang, { en: 'How it works', fr: 'Comment ça marche', de: 'So funktioniert’s', it: 'Come funziona' })}</a>
  </div>

  <h2>${L(lang, { en: 'The story', fr: 'L’histoire', de: 'Die Geschichte', it: 'La storia' })}</h2>
  ${paras(story)}

  <h2>${L(lang, { en: 'What JamWerk is', fr: 'Ce qu’est JamWerk', de: 'Was JamWerk ist', it: 'Cos’è JamWerk' })}</h2>
  <ul>
    <li>${L(lang, { en: 'A directory of musicians by instrument, level and city — with a message button.', fr: 'Un annuaire de musiciens par instrument, niveau et ville — avec un bouton message.', de: 'Ein Verzeichnis von Musiker:innen nach Instrument, Niveau und Stadt — mit Nachrichten-Button.', it: 'Un elenco di musicisti per strumento, livello e città — con un pulsante messaggio.' })}</li>
    <li>${L(lang, { en: 'Bands that present themselves with demos and a starting fee, and can be booked for events.', fr: 'Des groupes qui se présentent avec démos et tarif de départ, et qu’on peut réserver pour un événement.', de: 'Bands, die sich mit Demos und Startgage vorstellen und für Anlässe gebucht werden können.', it: 'Gruppi che si presentano con demo e tariffa di partenza e si possono prenotare per eventi.' })}</li>
    <li>${L(lang, { en: 'Jam groups and free practice listings.', fr: 'Des groupes de jam et des annonces de répétition gratuites.', de: 'Jam-Gruppen und kostenlose Probe-Inserate.', it: 'Gruppi jam e annunci di prova gratuiti.' })}</li>
    <li>${L(lang, { en: 'Paid dep gigs with the fee shown up front, in CHF or EUR.', fr: 'Des remplacements payés au cachet affiché d’avance, en CHF ou EUR.', de: 'Bezahlte Ersatz-Gigs mit vorab genannter Gage, in CHF oder EUR.', it: 'Sostituzioni pagate con il cachet indicato in anticipo, in CHF o EUR.' })}</li>
    <li><b>${L(lang, { en: '100% free for musicians — no fees, no commission.', fr: '100 % gratuit pour les musiciens — sans frais, sans commission.', de: '100 % gratis für Musiker:innen — keine Gebühren, keine Provision.', it: '100% gratis per i musicisti — niente costi, niente commissioni.' })}</b> ${L(lang, { en: 'Money between a band and whoever books them is their own business; JamWerk is not part of the transaction.', fr: 'L’argent entre un groupe et celui qui le réserve ne regarde qu’eux ; JamWerk n’intervient pas dans la transaction.', de: 'Geld zwischen einer Band und wer sie bucht ist deren Sache; JamWerk ist nicht Teil der Transaktion.', it: 'Il denaro tra un gruppo e chi lo prenota è affar loro; JamWerk non fa parte della transazione.' })}</li>
  </ul>

  <h2>${L(lang, { en: 'Contact & feedback', fr: 'Contact & retours', de: 'Kontakt & Feedback', it: 'Contatti & feedback' })}</h2>
  <p>${L(lang, { en: 'Something unclear, missing or broken? An instrument or genre we forgot? Tell us — every message is read by the person who builds the app, and small fixes usually ship within days.', fr: 'Quelque chose de pas clair, qui manque ou qui ne marche pas ? Un instrument ou un genre oublié ? Dites-le-nous — chaque message est lu par la personne qui construit l’app, et les petites corrections sortent en général en quelques jours.', de: 'Etwas unklar, fehlt oder kaputt? Ein Instrument oder Genre vergessen? Sag es uns — jede Nachricht liest die Person, die die App baut, und kleine Fixes kommen meist innert Tagen.', it: 'Qualcosa non è chiaro, manca o non funziona? Uno strumento o un genere dimenticato? Diccelo — ogni messaggio è letto da chi costruisce l’app, e le piccole correzioni escono di solito in pochi giorni.' })}</p>
  <a class="btn" href="/?feedback=1">${L(lang, { en: 'Write to us', fr: 'Écrivez-nous', de: 'Schreib uns', it: 'Scrivici' })}</a>

  <h2>${L(lang, { en: 'Legal notice', fr: 'Mentions légales', de: 'Impressum', it: 'Note legali' })}</h2>
  <div class="legal">
    <p><b>${L(lang, { en: 'Operator', fr: 'Éditeur', de: 'Betreiber', it: 'Editore' })}</b> — <span class="todo">JamWerk · [${L(lang, { en: 'name / company', fr: 'nom / raison sociale', de: 'Name / Firma', it: 'nome / ragione sociale' })}]</span>, ${L(lang, { en: 'Geneva, Switzerland', fr: 'Genève, Suisse', de: 'Genf, Schweiz', it: 'Ginevra, Svizzera' })}. ${L(lang, { en: 'Contact via the feedback form above.', fr: 'Contact via le formulaire de retours ci-dessus.', de: 'Kontakt über das Feedback-Formular oben.', it: 'Contatto tramite il modulo di feedback qui sopra.' })}</p>
    <p><b>${L(lang, { en: 'Hosting', fr: 'Hébergement', de: 'Hosting', it: 'Hosting' })}</b> — Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA (Workers, D1, R2). ${L(lang, { en: 'Transactional e-mail via Mailjet (Sinch), Paris, France.', fr: 'E-mails transactionnels via Mailjet (Sinch), Paris, France.', de: 'Transaktions-E-Mails über Mailjet (Sinch), Paris, Frankreich.', it: 'E-mail transazionali tramite Mailjet (Sinch), Parigi, Francia.' })}</p>
    <p><b>${L(lang, { en: 'Personal data', fr: 'Données personnelles', de: 'Personendaten', it: 'Dati personali' })}</b> — ${L(lang, {
      en: 'We store what you give us to run the service: e-mail address and password (hashed), your musician profile (instruments, city, demos, photo), your listings, applications, bands and messages, plus a language preference and, if you enable alerts, a push subscription. We do not sell or share this data, use no advertising trackers, and set only the cookie needed to keep you logged in. Your public page shows only what you chose to publish. You can delete your account and all its data at any time by asking through the feedback form. Processing follows the Swiss Federal Act on Data Protection (FADP) and, for users in the EU, the GDPR.',
      fr: 'Nous stockons ce que vous nous confiez pour faire fonctionner le service : adresse e-mail et mot de passe (haché), votre profil de musicien (instruments, ville, démos, photo), vos annonces, candidatures, groupes et messages, plus une préférence de langue et, si vous activez les alertes, un abonnement push. Nous ne vendons ni ne partageons ces données, n’utilisons aucun traceur publicitaire et ne posons que le cookie nécessaire à votre connexion. Votre page publique n’affiche que ce que vous avez choisi de publier. Vous pouvez supprimer votre compte et toutes ses données à tout moment en le demandant via le formulaire de retours. Le traitement respecte la loi fédérale suisse sur la protection des données (LPD) et, pour les utilisateurs de l’UE, le RGPD.',
      de: 'Wir speichern, was du uns für den Betrieb gibst: E-Mail-Adresse und Passwort (gehasht), dein Musikerprofil (Instrumente, Stadt, Demos, Foto), deine Inserate, Bewerbungen, Bands und Nachrichten, eine Sprachpräferenz und — falls du Alerts aktivierst — ein Push-Abonnement. Wir verkaufen oder teilen diese Daten nicht, nutzen keine Werbe-Tracker und setzen nur das Cookie, das dich eingeloggt hält. Deine öffentliche Seite zeigt nur, was du veröffentlichen wolltest. Du kannst dein Konto samt Daten jederzeit über das Feedback-Formular löschen lassen. Die Verarbeitung folgt dem Schweizer Datenschutzgesetz (DSG) und, für Nutzer:innen in der EU, der DSGVO.',
      it: 'Conserviamo ciò che ci fornisci per far funzionare il servizio: indirizzo e-mail e password (in hash), il tuo profilo di musicista (strumenti, città, demo, foto), i tuoi annunci, candidature, gruppi e messaggi, una preferenza di lingua e, se attivi gli avvisi, una sottoscrizione push. Non vendiamo né condividiamo questi dati, non usiamo tracker pubblicitari e impostiamo solo il cookie necessario a tenerti connesso. La tua pagina pubblica mostra solo ciò che hai scelto di pubblicare. Puoi eliminare il tuo account e tutti i dati in qualsiasi momento chiedendolo tramite il modulo di feedback. Il trattamento segue la legge federale svizzera sulla protezione dei dati (LPD) e, per gli utenti nell’UE, il GDPR.' })}</p>
    <p><b>${L(lang, { en: 'Content & conduct', fr: 'Contenus & comportement', de: 'Inhalte & Verhalten', it: 'Contenuti & comportamento' })}</b> — ${L(lang, {
      en: 'You are responsible for what you publish (texts, links, photos) and must hold the rights to it. Demos are embedded from YouTube, Vimeo, Spotify and SoundCloud under their own terms. Be decent in messages; you can block anyone, and accounts used for spam or harassment are removed.',
      fr: 'Vous êtes responsable de ce que vous publiez (textes, liens, photos) et devez en détenir les droits. Les démos sont intégrées depuis YouTube, Vimeo, Spotify et SoundCloud selon leurs propres conditions. Restez corrects dans les messages ; vous pouvez bloquer n’importe qui, et les comptes servant au spam ou au harcèlement sont supprimés.',
      de: 'Du bist für das verantwortlich, was du veröffentlichst (Texte, Links, Fotos), und musst die Rechte daran haben. Demos werden von YouTube, Vimeo, Spotify und SoundCloud unter deren Bedingungen eingebettet. Bleib anständig in Nachrichten; du kannst jede Person blockieren, und Konten für Spam oder Belästigung werden entfernt.',
      it: 'Sei responsabile di ciò che pubblichi (testi, link, foto) e devi detenerne i diritti. Le demo sono incorporate da YouTube, Vimeo, Spotify e SoundCloud secondo le loro condizioni. Sii corretto nei messaggi; puoi bloccare chiunque, e gli account usati per spam o molestie vengono rimossi.' })}</p>
    <p><b>${L(lang, { en: 'Liability', fr: 'Responsabilité', de: 'Haftung', it: 'Responsabilità' })}</b> — ${L(lang, {
      en: 'JamWerk connects people; it is not a party to any gig, booking or payment agreed between users and gives no guarantee about them. The service is provided as is, without warranty, and may change or pause. Swiss law applies; place of jurisdiction is Geneva.',
      fr: 'JamWerk met les gens en relation ; il n’est partie à aucun concert, réservation ou paiement convenu entre utilisateurs et n’offre aucune garantie à leur sujet. Le service est fourni en l’état, sans garantie, et peut évoluer ou être interrompu. Le droit suisse s’applique ; le for est à Genève.',
      de: 'JamWerk bringt Leute zusammen; es ist nicht Partei bei Gigs, Buchungen oder Zahlungen zwischen Nutzer:innen und gibt dafür keine Garantie. Der Dienst wird wie besehen, ohne Gewähr, bereitgestellt und kann sich ändern oder pausieren. Es gilt Schweizer Recht; Gerichtsstand ist Genf.',
      it: 'JamWerk mette in contatto le persone; non è parte di alcun concerto, prenotazione o pagamento concordato tra utenti e non offre garanzie in merito. Il servizio è fornito così com’è, senza garanzia, e può cambiare o essere sospeso. Si applica il diritto svizzero; foro competente Ginevra.' })}</p>
    <p>${L(lang, { en: 'Last updated', fr: 'Dernière mise à jour', de: 'Zuletzt aktualisiert', it: 'Ultimo aggiornamento' })}: 2026-08-27.</p>
  </div>
</main>
<footer>
  ${WAVE_SVG}
  <div class="inner">
    <a href="/" style="text-decoration: none;"><span class="brand">Jam<span>Werk</span></span></a>
    <a href="/?feedback=1">${L(lang, { en: 'Feedback', fr: 'Vos retours', de: 'Feedback', it: 'Feedback' })}</a>
    <span style="margin-left: auto;">© ${year} JamWerk</span>
  </div>
</footer>
</body>
</html>`);
});

export default aboutPage;
