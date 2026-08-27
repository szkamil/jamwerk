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

  <h2 id="terms">${L(lang, { en: 'Terms of use', fr: 'Conditions d’utilisation', de: 'Nutzungsbedingungen', it: 'Condizioni d’uso' })}</h2>
  <div class="legal">
    <p>${L(lang, {
      en: 'By creating an account or using jamwerk.app (“JamWerk”, “we”) you accept these terms. If you do not accept them, do not use the service.',
      fr: 'En créant un compte ou en utilisant jamwerk.app (« JamWerk », « nous »), vous acceptez les présentes conditions. Si vous ne les acceptez pas, n’utilisez pas le service.',
      de: 'Mit dem Erstellen eines Kontos oder der Nutzung von jamwerk.app („JamWerk“, „wir“) akzeptierst du diese Bedingungen. Wenn du sie nicht akzeptierst, nutze den Dienst nicht.',
      it: 'Creando un account o usando jamwerk.app («JamWerk», «noi») accetti queste condizioni. Se non le accetti, non usare il servizio.' })}</p>
    <p><b>1. ${L(lang, { en: 'What JamWerk is — and is not', fr: 'Ce que JamWerk est — et n’est pas', de: 'Was JamWerk ist — und nicht ist', it: 'Cosa JamWerk è — e non è' })}</b> — ${L(lang, {
      en: 'JamWerk is a free notice board and messaging tool that lets musicians, bands and people who book them find each other. JamWerk is not an agency, employer, promoter, booking platform, payment service, escrow, insurer or party to any agreement made between users. We do not vet, verify, select, recommend, supervise or guarantee any user, profile, listing, band, venue, event, demo or message.',
      fr: 'JamWerk est un tableau d’annonces et un outil de messagerie gratuits permettant aux musiciens, aux groupes et à ceux qui les réservent de se trouver. JamWerk n’est ni une agence, ni un employeur, ni un organisateur, ni une plateforme de réservation, ni un service de paiement, ni un séquestre, ni un assureur, ni partie à un quelconque accord conclu entre utilisateurs. Nous ne contrôlons, vérifions, sélectionnons, recommandons, supervisons ni garantissons aucun utilisateur, profil, annonce, groupe, lieu, événement, démo ou message.',
      de: 'JamWerk ist ein kostenloses Schwarzes Brett mit Nachrichtenfunktion, über das Musiker:innen, Bands und Personen, die sie buchen, sich finden. JamWerk ist keine Agentur, kein Arbeitgeber, kein Veranstalter, keine Buchungsplattform, kein Zahlungsdienst, kein Treuhänder, kein Versicherer und nicht Partei einer Vereinbarung zwischen Nutzer:innen. Wir prüfen, verifizieren, wählen aus, empfehlen, beaufsichtigen oder garantieren keine Nutzer:innen, Profile, Inserate, Bands, Orte, Veranstaltungen, Demos oder Nachrichten.',
      it: 'JamWerk è una bacheca e uno strumento di messaggistica gratuiti che permettono a musicisti, gruppi e a chi li prenota di trovarsi. JamWerk non è un’agenzia, un datore di lavoro, un promotore, una piattaforma di prenotazione, un servizio di pagamento, un deposito fiduciario, un assicuratore né parte di alcun accordo tra utenti. Non controlliamo, verifichiamo, selezioniamo, raccomandiamo, supervisioniamo né garantiamo alcun utente, profilo, annuncio, gruppo, luogo, evento, demo o messaggio.' })}</p>
    <p><b>2. ${L(lang, { en: 'Agreements between users', fr: 'Accords entre utilisateurs', de: 'Vereinbarungen zwischen Nutzer:innen', it: 'Accordi tra utenti' })}</b> — ${L(lang, {
      en: 'Any gig, replacement, standby, booking, rehearsal, jam, band membership, fee, payment, invoice, tax, social-security contribution, permit, insurance, copyright or performing-rights matter (e.g. SUISA/SACEM) is exclusively between the users involved. Fees shown on JamWerk are declared by the poster; we do not check, collect, hold, pay or guarantee them. You are solely responsible for your own contracts, for showing up, for the quality and legality of what you deliver, and for complying with the laws that apply to you.',
      fr: 'Tout concert, remplacement, réserve, réservation, répétition, jam, adhésion à un groupe, cachet, paiement, facture, impôt, cotisation sociale, autorisation, assurance, droit d’auteur ou droit voisin (p. ex. SUISA/SACEM) relève exclusivement des utilisateurs concernés. Les cachets affichés sur JamWerk sont déclarés par l’annonceur ; nous ne les vérifions, encaissons, conservons, versons ni garantissons. Vous êtes seul responsable de vos contrats, de votre présence, de la qualité et de la légalité de votre prestation, et du respect des lois qui vous sont applicables.',
      de: 'Jeder Gig, Ersatz, jede Reserve, Buchung, Probe, Jam, Bandmitgliedschaft, Gage, Zahlung, Rechnung, Steuer, Sozialabgabe, Bewilligung, Versicherung sowie Urheber- und Aufführungsrechte (z. B. SUISA/SACEM) betreffen ausschliesslich die beteiligten Nutzer:innen. Auf JamWerk angezeigte Gagen werden von der inserierenden Person angegeben; wir prüfen, kassieren, verwahren, zahlen oder garantieren sie nicht. Du bist allein verantwortlich für deine Verträge, dein Erscheinen, die Qualität und Rechtmässigkeit deiner Leistung und die Einhaltung der für dich geltenden Gesetze.',
      it: 'Ogni concerto, sostituzione, riserva, prenotazione, prova, jam, adesione a un gruppo, cachet, pagamento, fattura, imposta, contributo sociale, permesso, assicurazione, diritto d’autore o diritto connesso (es. SUISA/SIAE) riguarda esclusivamente gli utenti coinvolti. I cachet mostrati su JamWerk sono dichiarati da chi pubblica; non li verifichiamo, incassiamo, custodiamo, paghiamo né garantiamo. Sei l’unico responsabile dei tuoi contratti, della tua presenza, della qualità e legalità della tua prestazione e del rispetto delle leggi applicabili.' })}</p>
    <p><b>3. ${L(lang, { en: 'Your content and conduct', fr: 'Vos contenus et votre comportement', de: 'Deine Inhalte und dein Verhalten', it: 'I tuoi contenuti e il tuo comportamento' })}</b> — ${L(lang, {
      en: 'You are solely responsible for everything you publish or send (profiles, listings, band pages, photos, links, demos, messages) and warrant that you hold the necessary rights and that it is accurate, lawful and not misleading. Demos are embedded from YouTube, Vimeo, Spotify and SoundCloud under their own terms; we do not host or control them. You must not use JamWerk for spam, harassment, discrimination, fraud, scraping, impersonation or anything illegal. We may remove content and suspend or delete accounts at our discretion, without notice or liability.',
      fr: 'Vous êtes seul responsable de tout ce que vous publiez ou envoyez (profils, annonces, pages de groupe, photos, liens, démos, messages) et garantissez en détenir les droits nécessaires et que c’est exact, licite et non trompeur. Les démos sont intégrées depuis YouTube, Vimeo, Spotify et SoundCloud selon leurs propres conditions ; nous ne les hébergeons ni ne les contrôlons. Il est interdit d’utiliser JamWerk pour du spam, du harcèlement, de la discrimination, de la fraude, de l’extraction de données, de l’usurpation d’identité ou toute activité illégale. Nous pouvons retirer des contenus et suspendre ou supprimer des comptes à notre discrétion, sans préavis ni responsabilité.',
      de: 'Du bist allein verantwortlich für alles, was du veröffentlichst oder sendest (Profile, Inserate, Bandseiten, Fotos, Links, Demos, Nachrichten), und garantierst, dass du die nötigen Rechte hast und dass es korrekt, rechtmässig und nicht irreführend ist. Demos werden von YouTube, Vimeo, Spotify und SoundCloud unter deren Bedingungen eingebettet; wir hosten oder kontrollieren sie nicht. JamWerk darf nicht für Spam, Belästigung, Diskriminierung, Betrug, Scraping, Identitätsmissbrauch oder Illegales genutzt werden. Wir können Inhalte entfernen und Konten nach eigenem Ermessen ohne Vorankündigung und ohne Haftung sperren oder löschen.',
      it: 'Sei l’unico responsabile di tutto ciò che pubblichi o invii (profili, annunci, pagine di gruppo, foto, link, demo, messaggi) e garantisci di detenerne i diritti e che sia esatto, lecito e non ingannevole. Le demo sono incorporate da YouTube, Vimeo, Spotify e SoundCloud secondo le loro condizioni; non le ospitiamo né le controlliamo. È vietato usare JamWerk per spam, molestie, discriminazione, frode, scraping, furto d’identità o attività illegali. Possiamo rimuovere contenuti e sospendere o eliminare account a nostra discrezione, senza preavviso né responsabilità.' })}</p>
    <p><b>4. ${L(lang, { en: 'No warranty', fr: 'Absence de garantie', de: 'Keine Gewährleistung', it: 'Nessuna garanzia' })}</b> — ${L(lang, {
      en: 'JamWerk is provided “as is” and “as available”, free of charge, without any warranty of any kind, express or implied, including availability, accuracy, completeness, fitness for a particular purpose, non-infringement, security or that alerts, e-mails, push notifications or messages will be delivered on time or at all. We may change, suspend or stop the service or any feature at any time.',
      fr: 'JamWerk est fourni « en l’état » et « selon disponibilité », gratuitement, sans garantie d’aucune sorte, expresse ou implicite, notamment quant à la disponibilité, l’exactitude, l’exhaustivité, l’adéquation à un usage particulier, l’absence de contrefaçon, la sécurité, ou la remise à temps — ou tout court — des alertes, e-mails, notifications push ou messages. Nous pouvons modifier, suspendre ou arrêter le service ou toute fonctionnalité à tout moment.',
      de: 'JamWerk wird „wie besehen“ und „wie verfügbar“ kostenlos und ohne jegliche ausdrückliche oder stillschweigende Gewährleistung bereitgestellt, insbesondere ohne Gewähr für Verfügbarkeit, Richtigkeit, Vollständigkeit, Eignung für einen bestimmten Zweck, Nichtverletzung von Rechten, Sicherheit oder dafür, dass Alerts, E-Mails, Push-Benachrichtigungen oder Nachrichten rechtzeitig oder überhaupt zugestellt werden. Wir können den Dienst oder einzelne Funktionen jederzeit ändern, aussetzen oder einstellen.',
      it: 'JamWerk è fornito «così com’è» e «secondo disponibilità», gratuitamente, senza garanzia di alcun tipo, espressa o implicita, inclusa disponibilità, esattezza, completezza, idoneità a uno scopo particolare, non violazione, sicurezza o consegna puntuale — o consegna affatto — di avvisi, e-mail, notifiche push o messaggi. Possiamo modificare, sospendere o interrompere il servizio o qualsiasi funzione in ogni momento.' })}</p>
    <p><b>5. ${L(lang, { en: 'Limitation of liability', fr: 'Limitation de responsabilité', de: 'Haftungsbeschränkung', it: 'Limitazione di responsabilità' })}</b> — ${L(lang, {
      en: 'To the fullest extent permitted by law, JamWerk and the people behind it are not liable for any direct, indirect, incidental, special, consequential or punitive damage, or for any loss of profit, revenue, earnings, business, opportunity, goodwill, reputation or data, arising from or related to: the service or its unavailability; any listing, profile, band, demo or message; any gig, booking, standby, rehearsal, jam or event, including cancellations, no-shows, late arrivals, replacements, unpaid or disputed fees, or the quality of a performance; the conduct, identity, reliability or solvency of any user; injury, loss or damage to persons, instruments, equipment or property before, during or after an event; travel; third-party services, embeds, links or notifications; unauthorised access to your account; or errors, delays or interruptions of any kind. Because the service is free, our total aggregate liability towards you is limited to CHF 100. Nothing in these terms excludes liability that cannot be excluded under Swiss law (in particular for intent or gross negligence, or for personal injury).',
      fr: 'Dans toute la mesure permise par la loi, JamWerk et les personnes qui le font vivre ne sont pas responsables de tout dommage direct, indirect, accessoire, spécial, consécutif ou punitif, ni de toute perte de profit, de revenu, de gain, d’affaires, d’opportunité, de clientèle, de réputation ou de données, découlant de ou lié à : le service ou son indisponibilité ; toute annonce, profil, groupe, démo ou message ; tout concert, réservation, réserve, répétition, jam ou événement, y compris annulations, absences, retards, remplacements, cachets impayés ou contestés, ou la qualité d’une prestation ; le comportement, l’identité, la fiabilité ou la solvabilité de tout utilisateur ; toute blessure, perte ou dommage aux personnes, instruments, matériel ou biens avant, pendant ou après un événement ; les déplacements ; les services, intégrations, liens ou notifications de tiers ; l’accès non autorisé à votre compte ; ou toute erreur, tout retard ou toute interruption. Le service étant gratuit, notre responsabilité totale cumulée envers vous est limitée à CHF 100. Rien dans ces conditions n’exclut une responsabilité qui ne peut être exclue en droit suisse (en particulier en cas de dol ou de faute grave, ou de lésion corporelle).',
      de: 'Soweit gesetzlich zulässig haften JamWerk und die dahinterstehenden Personen nicht für direkte, indirekte, beiläufige, besondere, Folge- oder Strafschäden noch für entgangenen Gewinn, Umsatz, Einkommen, Geschäft, Chancen, Goodwill, Reputation oder Daten, die entstehen aus oder im Zusammenhang mit: dem Dienst oder seiner Nichtverfügbarkeit; einem Inserat, Profil, einer Band, Demo oder Nachricht; einem Gig, einer Buchung, Reserve, Probe, Jam oder Veranstaltung, einschliesslich Absagen, Nichterscheinen, Verspätungen, Ersatz, unbezahlter oder strittiger Gagen oder der Qualität einer Darbietung; dem Verhalten, der Identität, Zuverlässigkeit oder Zahlungsfähigkeit von Nutzer:innen; Verletzungen, Verlust oder Schäden an Personen, Instrumenten, Ausrüstung oder Eigentum vor, während oder nach einer Veranstaltung; Reisen; Diensten, Einbettungen, Links oder Benachrichtigungen Dritter; unbefugtem Zugriff auf dein Konto; oder Fehlern, Verzögerungen oder Unterbrechungen jeder Art. Da der Dienst kostenlos ist, ist unsere gesamte Haftung dir gegenüber auf CHF 100 beschränkt. Nichts in diesen Bedingungen schliesst eine Haftung aus, die nach Schweizer Recht nicht ausgeschlossen werden kann (insbesondere bei Absicht oder grober Fahrlässigkeit oder bei Personenschäden).',
      it: 'Nella misura massima consentita dalla legge, JamWerk e le persone che lo gestiscono non sono responsabili di alcun danno diretto, indiretto, incidentale, speciale, consequenziale o punitivo, né di alcuna perdita di profitto, ricavi, guadagni, affari, opportunità, avviamento, reputazione o dati, derivanti da o collegati a: il servizio o la sua indisponibilità; qualsiasi annuncio, profilo, gruppo, demo o messaggio; qualsiasi concerto, prenotazione, riserva, prova, jam o evento, incluse cancellazioni, assenze, ritardi, sostituzioni, cachet non pagati o contestati, o la qualità di una prestazione; la condotta, identità, affidabilità o solvibilità di qualsiasi utente; lesioni, perdite o danni a persone, strumenti, attrezzature o beni prima, durante o dopo un evento; spostamenti; servizi, incorporamenti, link o notifiche di terzi; accesso non autorizzato al tuo account; o errori, ritardi o interruzioni di qualsiasi tipo. Essendo il servizio gratuito, la nostra responsabilità complessiva verso di te è limitata a CHF 100. Nulla in queste condizioni esclude una responsabilità che non può essere esclusa secondo il diritto svizzero (in particolare per dolo o colpa grave, o per lesioni personali).' })}</p>
    <p><b>6. ${L(lang, { en: 'Indemnity', fr: 'Indemnisation', de: 'Freistellung', it: 'Manleva' })}</b> — ${L(lang, {
      en: 'You will hold JamWerk and the people behind it harmless from any claim, damage, cost or expense (including reasonable legal fees) arising from your content, your use of the service, your agreements with other users or your breach of these terms or of the law.',
      fr: 'Vous garantissez JamWerk et les personnes qui le font vivre contre toute réclamation, tout dommage, coût ou frais (y compris les honoraires raisonnables d’avocat) découlant de vos contenus, de votre utilisation du service, de vos accords avec d’autres utilisateurs ou de votre violation des présentes conditions ou de la loi.',
      de: 'Du stellst JamWerk und die dahinterstehenden Personen von allen Ansprüchen, Schäden, Kosten und Auslagen (einschliesslich angemessener Anwaltskosten) frei, die aus deinen Inhalten, deiner Nutzung des Dienstes, deinen Vereinbarungen mit anderen Nutzer:innen oder deinem Verstoss gegen diese Bedingungen oder das Gesetz entstehen.',
      it: 'Manlevi JamWerk e le persone che lo gestiscono da qualsiasi pretesa, danno, costo o spesa (incluse ragionevoli spese legali) derivante dai tuoi contenuti, dal tuo uso del servizio, dai tuoi accordi con altri utenti o dalla tua violazione di queste condizioni o della legge.' })}</p>
    <p><b>7. ${L(lang, { en: 'Accounts, changes, general', fr: 'Comptes, modifications, généralités', de: 'Konten, Änderungen, Allgemeines', it: 'Account, modifiche, disposizioni generali' })}</b> — ${L(lang, {
      en: 'You must be at least 16 and keep your login confidential; you are responsible for activity under your account. We may update these terms; continued use after an update means acceptance. If a clause is invalid, the rest remains in force. These terms are governed by Swiss law, excluding conflict-of-law rules; the courts of Geneva, Switzerland have exclusive jurisdiction, mandatory venues reserved.',
      fr: 'Vous devez avoir au moins 16 ans et garder vos identifiants confidentiels ; vous êtes responsable de l’activité sous votre compte. Nous pouvons modifier ces conditions ; continuer d’utiliser le service après une modification vaut acceptation. Si une clause est nulle, les autres restent en vigueur. Les présentes conditions sont régies par le droit suisse, à l’exclusion des règles de conflit de lois ; les tribunaux de Genève, Suisse, sont exclusivement compétents, fors impératifs réservés.',
      de: 'Du musst mindestens 16 Jahre alt sein und deine Zugangsdaten vertraulich halten; du bist für Aktivitäten unter deinem Konto verantwortlich. Wir können diese Bedingungen ändern; die weitere Nutzung nach einer Änderung gilt als Zustimmung. Ist eine Klausel unwirksam, bleiben die übrigen in Kraft. Es gilt Schweizer Recht unter Ausschluss des Kollisionsrechts; ausschliesslicher Gerichtsstand ist Genf, Schweiz, zwingende Gerichtsstände vorbehalten.',
      it: 'Devi avere almeno 16 anni e mantenere riservate le tue credenziali; sei responsabile dell’attività del tuo account. Possiamo aggiornare queste condizioni; l’uso continuato dopo un aggiornamento vale come accettazione. Se una clausola è invalida, le altre restano in vigore. Queste condizioni sono regolate dal diritto svizzero, escluse le norme di conflitto; foro esclusivo Ginevra, Svizzera, fatti salvi i fori imperativi.' })}</p>
  </div>

  <h2 id="privacy">${L(lang, { en: 'Privacy notice', fr: 'Politique de confidentialité', de: 'Datenschutzhinweise', it: 'Informativa sulla privacy' })}</h2>
  <div class="legal">
    <p><b>${L(lang, { en: 'Personal data', fr: 'Données personnelles', de: 'Personendaten', it: 'Dati personali' })}</b> — ${L(lang, {
      en: 'We store what you give us to run the service: e-mail address and password (hashed), your musician profile (instruments, city, demos, photo), your listings, applications, bands and messages, plus a language preference and, if you enable alerts, a push subscription. We do not sell or share this data, use no advertising trackers, and set only the cookie needed to keep you logged in. Your public page shows only what you chose to publish. You can delete your account and all its data at any time by asking through the feedback form. Processing follows the Swiss Federal Act on Data Protection (FADP) and, for users in the EU, the GDPR.',
      fr: 'Nous stockons ce que vous nous confiez pour faire fonctionner le service : adresse e-mail et mot de passe (haché), votre profil de musicien (instruments, ville, démos, photo), vos annonces, candidatures, groupes et messages, plus une préférence de langue et, si vous activez les alertes, un abonnement push. Nous ne vendons ni ne partageons ces données, n’utilisons aucun traceur publicitaire et ne posons que le cookie nécessaire à votre connexion. Votre page publique n’affiche que ce que vous avez choisi de publier. Vous pouvez supprimer votre compte et toutes ses données à tout moment en le demandant via le formulaire de retours. Le traitement respecte la loi fédérale suisse sur la protection des données (LPD) et, pour les utilisateurs de l’UE, le RGPD.',
      de: 'Wir speichern, was du uns für den Betrieb gibst: E-Mail-Adresse und Passwort (gehasht), dein Musikerprofil (Instrumente, Stadt, Demos, Foto), deine Inserate, Bewerbungen, Bands und Nachrichten, eine Sprachpräferenz und — falls du Alerts aktivierst — ein Push-Abonnement. Wir verkaufen oder teilen diese Daten nicht, nutzen keine Werbe-Tracker und setzen nur das Cookie, das dich eingeloggt hält. Deine öffentliche Seite zeigt nur, was du veröffentlichen wolltest. Du kannst dein Konto samt Daten jederzeit über das Feedback-Formular löschen lassen. Die Verarbeitung folgt dem Schweizer Datenschutzgesetz (DSG) und, für Nutzer:innen in der EU, der DSGVO.',
      it: 'Conserviamo ciò che ci fornisci per far funzionare il servizio: indirizzo e-mail e password (in hash), il tuo profilo di musicista (strumenti, città, demo, foto), i tuoi annunci, candidature, gruppi e messaggi, una preferenza di lingua e, se attivi gli avvisi, una sottoscrizione push. Non vendiamo né condividiamo questi dati, non usiamo tracker pubblicitari e impostiamo solo il cookie necessario a tenerti connesso. La tua pagina pubblica mostra solo ciò che hai scelto di pubblicare. Puoi eliminare il tuo account e tutti i dati in qualsiasi momento chiedendolo tramite il modulo di feedback. Il trattamento segue la legge federale svizzera sulla protezione dei dati (LPD) e, per gli utenti nell’UE, il GDPR.' })}</p>
    <p>${L(lang, { en: 'Last updated', fr: 'Dernière mise à jour', de: 'Zuletzt aktualisiert', it: 'Ultimo aggiornamento' })}: 2026-08-27.</p>
  </div>
</main>
<footer>
  ${WAVE_SVG}
  <div class="inner">
    <a href="/" style="text-decoration: none;"><span class="brand">Jam<span>Werk</span></span></a>
    <a href="/?feedback=1">${L(lang, { en: 'Feedback', fr: 'Vos retours', de: 'Feedback', it: 'Feedback' })}</a>
    <a href="/about#terms">${L(lang, { en: 'Terms', fr: 'Conditions', de: 'Bedingungen', it: 'Condizioni' })}</a>
    <span style="margin-left: auto;">© ${year} JamWerk</span>
  </div>
</footer>
</body>
</html>`);
});

export default aboutPage;
