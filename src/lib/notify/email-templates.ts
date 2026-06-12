import { appUrl, unsubscribeUrl } from './email';

/**
 * ETAPA 78 C1 — cele patru emailuri, toate în română cu diacritice, pe brand
 * (violet pe fundal închis în antet, corp alb citeț pe telefon), cu dezabonare
 * OBLIGATORIE în footer. HTML simplu de email: tabele, stiluri inline, fără
 * CSS extern — randabil în Gmail/Outlook/Apple Mail.
 */

const BRAND = {
  violet: '#8b5cf6',
  dark: '#171a2b',
  text: '#1f2333',
  muted: '#6b7186',
  bg: '#f4f4f8',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 8px"><tr><td style="border-radius:9999px;background:${BRAND.violet}">
    <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:9999px">${esc(label)}</a>
  </td></tr></table>`;
}

/** scheletul comun: antet pe brand, corp alb, footer cu dezabonare */
function layout(userId: string, title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:${BRAND.dark};padding:20px 28px">
          <span style="font-size:17px;font-weight:700;color:#ffffff">Profesor Maxim</span>
          <span style="font-size:13px;color:#a9aec4"> · matematică pentru BAC</span>
        </td></tr>
        <tr><td style="padding:28px;color:${BRAND.text};font-size:15px;line-height:1.65">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 28px 26px;border-top:1px solid #ececf2">
          <p style="margin:0;font-size:12px;color:${BRAND.muted};line-height:1.6">
            Primești acest email pentru că ai un cont pe Profesor Maxim.<br>
            <a href="${unsubscribeUrl(userId)}" style="color:${BRAND.muted};text-decoration:underline">Dezabonează-mă de la emailuri</a>
            · <a href="${appUrl()}/app/setari" style="color:${BRAND.muted};text-decoration:underline">Setări notificări</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function salut(name: string | null): string {
  return name ? `Salut, ${esc(name.split(' ')[0])}!` : 'Salut!';
}

// ── (1) BUN VENIT — la signup ────────────────────────────────────────────────
export function emailBunVenit(userId: string, name: string | null): { subject: string; html: string } {
  const subject = 'Bine ai venit! Uite ce urmează';
  const html = layout(userId, subject, `
    <h1 style="margin:0 0 14px;font-size:21px;color:${BRAND.dark}">${salut(name)}</h1>
    <p style="margin:0 0 12px">Contul tău e gata. De aici, drumul e simplu:</p>
    <ol style="margin:0 0 12px;padding-left:22px">
      <li style="margin-bottom:8px"><strong>Diagnosticul</strong> — câteva exerciții ca să văd exact unde ești acum. Fără note, fără judecată.</li>
      <li style="margin-bottom:8px"><strong>Harta ta</strong> — primești harta personală a materiei: ce stăpânești, ce urmează, pas cu pas până la BAC.</li>
    </ol>
    <p style="margin:0">Zece minute azi îți arată tot drumul de aici încolo.</p>
    ${button(`${appUrl()}/onboarding/welcome`, 'Începe diagnosticul')}
  `);
  return { subject, html };
}

// ── (2) STREAK RUPT — a doua zi după întrerupere, ton cald ───────────────────
export function emailStreakRupt(
  userId: string,
  name: string | null,
  lostStreak: number
): { subject: string; html: string } {
  const subject = 'Seria s-a oprit — dar nu s-a pierdut nimic';
  const html = layout(userId, subject, `
    <h1 style="margin:0 0 14px;font-size:21px;color:${BRAND.dark}">${salut(name)}</h1>
    <p style="margin:0 0 12px">Seria ta de <strong>${lostStreak} zile</strong> s-a oprit ieri. Se întâmplă — o zi plină, un test, viața.</p>
    <p style="margin:0 0 12px">Ce ai învățat în zilele acelea rămâne al tău. Singurul lucru care contează acum e ziua de azi: daily-ul te așteaptă, durează vreo 5 minute, și seria pornește din nou de la 1.</p>
    <p style="margin:0;color:${BRAND.muted}">Matematica se învață în zile mici, nu în nopți mari.</p>
    ${button(`${appUrl()}/app/azi`, 'Fă daily-ul de azi')}
  `);
  return { subject, html };
}

// ── (3) RAPORTUL SĂPTĂMÂNAL — duminică, numai din date reale ─────────────────
export interface WeeklyData {
  lessons: number;
  attempts: number;
  correct: number;
  streak: number;
  concepts: string[];
  nextConcept: string | null;
}

export function emailRaportSaptamanal(
  userId: string,
  name: string | null,
  data: WeeklyData,
  opts?: { forParent?: boolean }
): { subject: string; html: string } {
  const active = data.lessons > 0 || data.attempts > 0;
  const cine = opts?.forParent ? (name ? esc(name.split(' ')[0]) : 'copilul dumneavoastră') : null;

  if (!active) {
    // fără activitate → varianta scurtă de re-angajare, fără înfrumusețare
    const subject = opts?.forParent
      ? `Săptămâna aceasta: nicio activitate pe Profesor Maxim`
      : 'O săptămână liniștită — hai înapoi cu 5 minute';
    const html = layout(userId, subject, opts?.forParent
      ? `
        <h1 style="margin:0 0 14px;font-size:21px;color:${BRAND.dark}">Raportul săptămânal</h1>
        <p style="margin:0 0 12px">${cine} nu a lucrat nimic pe platformă săptămâna aceasta.</p>
        <p style="margin:0">Un singur daily de 5 minute pe zi face diferența până la BAC — merită un semn de încurajare.</p>
      `
      : `
        <h1 style="margin:0 0 14px;font-size:21px;color:${BRAND.dark}">${salut(name)}</h1>
        <p style="margin:0 0 12px">Săptămâna aceasta n-ai apucat să lucrezi nimic — și e în regulă, se întâmplă.</p>
        <p style="margin:0 0 12px">Vestea bună: nu trebuie să recuperezi nimic. Daily-ul de azi are 3 exerciții alese exact pentru tine, vreo 5 minute.</p>
        ${button(`${appUrl()}/app/azi`, 'Reia de unde ai rămas')}
      `);
    return { subject, html };
  }

  const acc = data.attempts > 0 ? Math.round((100 * data.correct) / data.attempts) : 0;
  const conceptsList = data.concepts.length
    ? `<ul style="margin:6px 0 0;padding-left:22px">${data.concepts.map((c) => `<li style="margin-bottom:4px">${esc(c)}</li>`).join('')}</ul>`
    : '';
  const statRow = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #ececf2;color:${BRAND.muted};font-size:14px">${label}</td>
     <td style="padding:8px 0;border-bottom:1px solid #ececf2;text-align:right;font-weight:700;color:${BRAND.dark}">${value}</td></tr>`;

  const subject = opts?.forParent
    ? 'Raportul săptămânal — progresul la matematică'
    : 'Săptămâna ta în cifre';
  const intro = opts?.forParent
    ? `<p style="margin:0 0 12px">Ce a lucrat ${cine} săptămâna aceasta pe Profesor Maxim:</p>`
    : `<p style="margin:0 0 12px">Uite ce ai construit săptămâna aceasta — cifre reale, nu laude:</p>`;

  const html = layout(userId, subject, `
    <h1 style="margin:0 0 14px;font-size:21px;color:${BRAND.dark}">${opts?.forParent ? 'Raportul săptămânal' : salut(name)}</h1>
    ${intro}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px">
      ${statRow('Lecții făcute', String(data.lessons))}
      ${statRow('Exerciții corecte / încercate', `${data.correct} / ${data.attempts}${data.attempts > 0 ? ` (${acc}%)` : ''}`)}
      ${statRow('Streak curent', `${data.streak} ${data.streak === 1 ? 'zi' : 'zile'}`)}
    </table>
    ${data.concepts.length ? `<p style="margin:0 0 4px"><strong>Concepte avansate săptămâna aceasta:</strong></p>${conceptsList}` : ''}
    ${data.nextConcept ? `<p style="margin:16px 0 0">Săptămâna viitoare te așteaptă: <strong>${esc(data.nextConcept)}</strong>.</p>` : ''}
    ${opts?.forParent ? '' : button(`${appUrl()}/app/azi`, 'Continuă de aici')}
  `);
  return { subject, html };
}

// ── (4a) TRIALUL EXPIRĂ — cu 2 zile înainte ──────────────────────────────────
export function emailTrialExpira(
  userId: string,
  name: string | null,
  daysLeft: number,
  endDate: string
): { subject: string; html: string } {
  const zile = daysLeft === 1 ? 'o zi' : `${daysLeft} zile`;
  const subject = `Trialul tău se încheie în ${zile}`;
  const html = layout(userId, subject, `
    <h1 style="margin:0 0 14px;font-size:21px;color:${BRAND.dark}">${salut(name)}</h1>
    <p style="margin:0 0 12px">Perioada ta de probă se încheie pe <strong>${esc(endDate)}</strong> — mai ai ${zile} de acces complet.</p>
    <p style="margin:0 0 12px">Dacă vrei să mergi mai departe cu tot ce ai acum (lecții, daily, simulări, chat nelimitat), alege un abonament. Dacă nu, contul rămâne al tău pe planul gratuit — nimic nu se pierde.</p>
    ${button(`${appUrl()}/app/abonament`, 'Vezi abonamentul')}
  `);
  return { subject, html };
}

// ── (4b) PLATA RESTANTĂ — past_due, cu link de plată ─────────────────────────
export function emailPlataRestanta(userId: string, name: string | null): { subject: string; html: string } {
  const subject = 'Plata abonamentului nu a reușit';
  const html = layout(userId, subject, `
    <h1 style="margin:0 0 14px;font-size:21px;color:${BRAND.dark}">${salut(name)}</h1>
    <p style="margin:0 0 12px">Ultima plată pentru abonamentul tău nu a reușit. Nicio panică: accesul tău rămâne activ câteva zile, timp în care poți reîncerca plata.</p>
    <p style="margin:0 0 12px">Dacă plata nu se reia, contul trece automat pe planul gratuit — progresul tău rămâne salvat oricum.</p>
    ${button(`${appUrl()}/app/abonament`, 'Reîncearcă plata')}
  `);
  return { subject, html };
}
