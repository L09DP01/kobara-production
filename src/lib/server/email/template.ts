import { parseDocument } from 'htmlparser2';

type EmailNode = ReturnType<typeof parseDocument>['children'][number];
export type EmailDesign = {
  subject: string;
  text: string;
  html?: string;
  kind?: 'transactional' | 'marketing';
  presentation?: EmailPresentation;
};

export type MessagePurpose = 'classic' | 'security' | 'verification' | 'support' | 'invitation' | 'marketing' | 'internal';

export type EmailPresentation = {
  type: 'message';
  purpose: MessagePurpose;
  heading?: string;
  context?: string;
} | {
  type: 'otp';
  code: string;
  expiresInMinutes: number;
  internal?: boolean;
  purpose?: 'login' | 'withdrawal' | 'transfer' | 'support' | 'admin';
  intro?: string;
  details?: { label: string; value: string }[];
} | {
  type: 'transaction';
  operation?: 'payment' | 'withdrawal' | 'transfer';
  source?: 'api' | 'payment_link';
  status: 'pending' | 'approved' | 'succeeded' | 'failed' | 'rejected' | 'cancelled';
  amount?: number;
  currency?: string;
  reference?: string;
  date?: string;
  method?: string;
  merchantName?: string;
  description?: string;
  notice?: string;
  intro?: string;
  action?: { url: string; label: string };
};

export const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? escapeEmailHtml(value) : '';
  } catch { return ''; }
}

function nodeText(node: EmailNode): string {
  if (node.type === 'text') return node.data;
  return 'children' in node ? node.children.map(nodeText).join('') : '';
}

function codeBlock(code: string) {
  // A single selectable code avoids copying spaces or separators into OTP fields.
  return `<p style="margin:24px 0;text-align:center;background:#101a34;border-bottom:4px solid #ff6b00;border-radius:8px;padding:24px 8px"><code style="display:inline-block;max-width:100%;box-sizing:border-box;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:38px;line-height:1.5;font-weight:700;letter-spacing:0">${escapeEmailHtml(code)}</code></p>`;
}

const styles: Record<string, string> = {
  p: 'margin:0 0 20px;color:#555b6c;font-size:16px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere',
  h1: 'margin:0 0 24px;color:#101a34;font-size:28px;line-height:1.3;font-weight:700;text-align:left;overflow-wrap:anywhere',
  h2: 'margin:24px 0 18px;color:#161923;font-size:24px;line-height:1.3;font-weight:700;overflow-wrap:anywhere',
  h3: 'margin:24px 0 12px;color:#161923;font-size:18px;line-height:1.4;font-weight:700',
  table: 'width:100%;table-layout:fixed;border-collapse:collapse;background:#ffffff;margin:20px 0',
  td: 'padding:13px 10px;border-bottom:1px solid #e5e1da;color:#555b6c;font-size:14px;line-height:1.6;vertical-align:top;overflow-wrap:anywhere;word-break:break-word',
  th: 'padding:13px 10px;border-bottom:1px solid #e5e1da;color:#161923;font-size:14px;line-height:1.6;text-align:left;overflow-wrap:anywhere',
  ul: 'padding-left:22px;margin:16px 0 24px;color:#555b6c;font-size:16px;line-height:1.7',
  ol: 'padding-left:22px;margin:16px 0 24px;color:#555b6c;font-size:16px;line-height:1.7',
  li: 'margin-bottom:10px;overflow-wrap:anywhere',
  blockquote: 'margin:24px 0;padding:16px;border-left:3px solid #ff6b00;background:#fff4e9;color:#75421c;line-height:1.7',
  pre: 'white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f5f2;padding:16px;font-size:14px;line-height:1.7',
  code: 'font-family:Consolas,monospace;overflow-wrap:anywhere',
  strong: 'font-weight:700;color:#161923',
  hr: 'border:0;border-top:1px solid #e5e1da;margin:24px 0',
};

function restyleHtml(html: string): string {
  const render = (node: EmailNode): string => {
    if (node.type === 'text') return escapeEmailHtml(node.data);
    if (!('name' in node) || !('children' in node)) return '';
    const tag = node.name.toLowerCase();
    if (['head', 'script', 'style', 'iframe', 'object', 'form', 'input', 'button', 'svg'].includes(tag)) return '';
    const text = nodeText(node).trim();
    if ((tag === 'h1' || tag === 'h2') && /^kobara(?: app)?$/i.test(text)) return '';
    if (tag === 'p' && (/^© \d{4} Kobara App\. Tous droits réservés\.$/.test(text) || text === 'Infrastructure de paiement pour Haïti.')) return '';
    if (['span', 'code', 'p', 'div'].includes(tag) && /^\d{6}$/.test(text)) return codeBlock(text);
    if (['p', 'strong'].includes(tag) && /^[+$\d][\d\s.,$]*\s*(?:HTG|USD)$/i.test(text)) {
      return `<${tag === 'strong' ? 'span' : 'p'} style="display:block;margin:24px 0;text-align:center;font-size:32px;line-height:1.3;font-weight:700;color:#161923;overflow-wrap:anywhere">${escapeEmailHtml(text)}</${tag === 'strong' ? 'span' : 'p'}>`;
    }
    const body = node.children.map(render).join('');
    if (tag === 'a') {
      const href = safeUrl(node.attribs.href || '');
      if (!href) return body;
      const isButton = /(?:background|inline-block)/i.test(node.attribs.style || '')
        && !/unsubscribe|désabonn|desabonn/i.test(text + href);
      if (isButton) {
        try { const url = new URL(node.attribs.href); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return body; } catch { return body; }
      }
      return `<a href="${href}" style="${isButton
        ? 'display:inline-block;box-sizing:border-box;max-width:100%;background:#101a34;color:#ffffff;padding:15px 26px;border-radius:8px;font-size:14px;line-height:1.5;font-weight:700;text-decoration:none;text-align:center;overflow-wrap:anywhere'
        : 'color:#b84a00;text-decoration:underline;overflow-wrap:anywhere'}">${body}</a>`;
    }
    if (tag === 'img') {
      const src = safeUrl(node.attribs.src || '');
      return src ? `<img src="${src}" alt="${escapeEmailHtml(node.attribs.alt || '')}" style="max-width:100%;height:auto;border:0" />` : '';
    }
    if (tag === 'br') return '<br />';
    if (tag === 'hr') return `<hr style="${styles.hr}" />`;
    if (styles[tag]) return `<${tag} style="${styles[tag]}${tag === 'p' && /text-align\s*:\s*center/i.test(node.attribs.style || '') ? ';text-align:center' : ''}">${body}</${tag}>`;
    if (['tr', 'thead', 'tbody', 'tfoot', 'em', 'b', 'i', 'u'].includes(tag)) return `<${tag}>${body}</${tag}>`;
    // Discard old fixed-width layout wrappers and their client-specific CSS.
    if (tag === 'div' && /background/i.test(node.attribs.style || '') && !/max-width|width:\s*100%/i.test(node.attribs.style || '') && text.length < 1000) {
      return `<div style="background:#f6f5f2;border:1px solid #e5e1da;border-radius:8px;padding:18px;margin:20px 0;overflow-wrap:anywhere;color:#555b6c;line-height:1.7">${body}</div>`;
    }
    return ['div', 'section', 'article'].includes(tag) ? `<div style="overflow-wrap:anywhere">${body}</div>` : body;
  };
  return parseDocument(html).children.map(render).join('');
}

function textContent(text: string) {
  const parts: string[] = [];
  let details: string[] = [];
  const flushDetails = () => {
    if (details.length) parts.push(`<table role="presentation" style="${styles.table}">${details.join('')}</table>`);
    details = [];
  };
  for (const line of text.split(/\r?\n/)) {
    // Legacy plain-text alerts use visual separators; HTML has its own spacing.
    if (/^[\s━─=_-]{4,}$/.test(line)) continue;
    const field = line.match(/^\s*(Référence|Reference|Entreprise|Marchand|Rôle|Statut(?: KYC)?|Score|Document|Date(?: et heure)?|Heure|Adresse IP|Téléphone|Email|E-mail|Ticket|Montant|Méthode|Moyen de paiement)\s*:\s*(.+)$/i);
    if (field) {
      details.push(`<tr><td style="${styles.td};width:42%">${escapeEmailHtml(field[1])}</td><td style="${styles.td};width:58%;color:#101a34;font-weight:700">${escapeEmailHtml(field[2])}</td></tr>`);
      continue;
    }
    flushDetails();
    parts.push(renderLine(line));
  }
  flushDetails();
  return parts.join('');
  function renderLine(line: string) {
    if (/^\s*\d{6}\s*$/.test(line)) return codeBlock(line.trim());
    if (!line.trim()) return '<div style="height:12px;line-height:12px">&nbsp;</div>';
    const linked = line.split(/(https?:\/\/[^\s<>]+)/g).map(part => {
      const url = /^https?:\/\//.test(part) ? safeUrl(part) : '';
      return url ? `<a href="${url}" style="color:#b84a00;overflow-wrap:anywhere">${escapeEmailHtml(part)}</a>` : escapeEmailHtml(part);
    }).join('');
    return `<p style="${styles.p};margin-bottom:6px">${linked}</p>`;
  }
}

export function emailAppearance(subject: string, kind?: EmailDesign['kind']) {
  const internal = /\[(?:APPROBATION REQUISE|NOUVEAU RETRAIT|KYC|Kobara Compliance)|super\s*admin|accès administrateur|suivi humain requis|whatsapp en attente/i.test(subject);
  const security = /connexion|passe|passkey|2fa|authentification|sécurité|securite|identité.*utilis|identite.*utilis|code de vérification|code de verification|activez votre compte/i.test(subject);
  const category = internal ? 'INTERNE' : kind === 'marketing' ? 'ACTUALITÉS' : security ? 'SÉCURITÉ'
    : /retrait|transfert/i.test(subject) ? 'RETRAITS' : /paiement|commande/i.test(subject) ? 'PAIEMENTS'
    : /kyc|vérification|verification/i.test(subject) ? 'VÉRIFICATION'
    : /ticket|assistance|demande reçue|réponse|reponse|\[K[B\-]/i.test(subject) ? 'SUPPORT'
    : /invit|developer|développeur|ambassadeur|parrainage/i.test(subject) ? 'ÉQUIPE' : 'COMPTE';
  const failed = /échou|echou|refus|bloqu|suspend|suspension|fraude|alerte/i.test(subject);
  const success = !failed && /(?:confirmé|confirme|réussi|reussi|validé|valide|reçu|recu|complété|complete|activé|active|autorisée?|autorise)(?:e|s)?(?=\s|$|[.!])/i.test(subject);
  return { internal, security, category, color: failed ? '#dc4353' : success ? '#13a875' : '#ff7a1a', symbol: failed ? '!' : success ? '&#10003;' : '&#8599;' };
}

const messageStyles: Record<MessagePurpose, { label: string; context: string; color: string }> = {
  classic: { label: 'CORRESPONDANCE', context: 'Votre compte Kobara', color: '#596579' },
  security: { label: 'SÉCURITÉ DU COMPTE', context: 'Informations de sécurité', color: '#9b503b' },
  verification: { label: 'VÉRIFICATION', context: 'Suivi de votre vérification', color: '#9b503b' },
  support: { label: 'ASSISTANCE', context: 'Votre échange avec Kobara', color: '#596579' },
  invitation: { label: 'ÉQUIPE ET PARTENAIRES', context: 'Vos accès et collaborations', color: '#9b503b' },
  marketing: { label: 'ACTUALITÉS KOBARA', context: 'Pour votre activité', color: '#9b503b' },
  internal: { label: 'USAGE INTERNE · SYSTEM CORE', context: 'Information destinée à l’équipe Kobara', color: '#596579' },
};

function messagePurpose(appearance: ReturnType<typeof emailAppearance>, kind?: EmailDesign['kind']): MessagePurpose {
  if (appearance.internal) return 'internal';
  if (kind === 'marketing') return 'marketing';
  if (appearance.security) return 'security';
  if (appearance.category === 'VÉRIFICATION') return 'verification';
  if (appearance.category === 'SUPPORT') return 'support';
  if (appearance.category === 'ÉQUIPE') return 'invitation';
  return 'classic';
}

function transactionContent(subject: string, text: string, data: Extract<EmailPresentation, { type: 'transaction' }>) {
  const states = {
    pending: { label: 'En attente', color: '#a85a10', background: '#fff4df', icon: '&#8987;' },
    approved: { label: 'Approuvé · en attente d’exécution', color: '#a85a10', background: '#fff4df', icon: '&#8987;' },
    succeeded: { label: 'Confirmé', color: '#087b56', background: '#e7f7ef', icon: '&#10003;' },
    failed: { label: 'Échoué', color: '#b42335', background: '#fff0f1', icon: '&#10005;' },
    rejected: { label: 'Refusé', color: '#b42335', background: '#fff0f1', icon: '&#10005;' },
    cancelled: { label: 'Annulé', color: '#596579', background: '#eef1f6', icon: '&#8212;' },
  };
  const state = states[data.status];
  if (!state) throw new Error('Invalid transaction email status');
  const escape = escapeEmailHtml;
  const operation = data.operation || 'payment';
  const operationName = operation === 'withdrawal' ? 'Retrait' : operation === 'transfer' ? 'Transfert' : 'Paiement';
  const titles = {
    pending: `Votre ${operationName.toLowerCase()} est en attente`,
    approved: `Votre ${operationName.toLowerCase()} est approuvé`,
    succeeded: `Votre ${operationName.toLowerCase()} est confirmé !`,
    failed: `Votre ${operationName.toLowerCase()} a échoué`,
    rejected: `Votre ${operationName.toLowerCase()} a été refusé`,
    cancelled: `Votre ${operationName.toLowerCase()} a été annulé`,
  };
  const label = `${operationName} ${data.status === 'succeeded' ? 'réussi' : data.status === 'pending' ? 'en attente' : data.status === 'approved' ? 'approuvé · exécution en attente' : state.label.toLowerCase()}`;
  const rows = [['Référence', data.reference], ['Date', data.date], ['Moyen de paiement', data.method], ['Marchand', data.merchantName], ['Description', data.source === 'api' ? undefined : data.description]]
    .filter((row): row is [string, string] => typeof row[1] === 'string' && Boolean(row[1].trim()))
    .map(([label, value]) => `<tr><td style="padding:18px 0;border-bottom:1px solid #edf0f4;color:#7b8495;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;width:44%;vertical-align:top;overflow-wrap:anywhere">${label}</td><td align="right" style="padding:18px 0 18px 12px;border-bottom:1px solid #edf0f4;color:#102044;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;width:56%;vertical-align:top;overflow-wrap:anywhere;font-weight:600">${escape(value)}</td></tr>`).join('');
  const amount = typeof data.amount === 'number' && Number.isFinite(data.amount) && data.amount >= 0 && data.currency
    ? `<table role="presentation" width="100%" style="background:#f8f9fd;border:1px solid #e7eaf0;border-radius:8px;margin:26px 0 20px"><tr><td align="center" style="padding:24px 12px;font-family:Arial,Helvetica,sans-serif"><p style="margin:0 0 14px;color:#7a8496;font-size:12px">MONTANT DE LA TRANSACTION</p><p style="margin:0 0 14px;font-size:34px;line-height:1.3;font-weight:700;color:#102044;overflow-wrap:anywhere">${escape(data.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} ${escape(data.currency)}</p><span style="display:inline-block;padding:7px 12px;border-radius:8px;background:${state.background};color:${state.color};font-size:12px;font-weight:700">${escape(label)}</span></td></tr></table>` : '';
  let actionUrl = '';
  try { const url = new URL(data.action?.url || ''); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) actionUrl = safeUrl(url.href); } catch { /* Optional CTA. */ }
  const action = actionUrl && data.action?.label.trim() ? `<p style="text-align:center;margin:18px 0"><a href="${actionUrl}" style="display:block;width:100%;box-sizing:border-box;background:#101a34;border-radius:8px;padding:17px 14px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;overflow-wrap:anywhere">${escape(data.action.label)}</a></p>` : '';
  return `<div style="text-align:center;font-family:Arial,Helvetica,sans-serif"><span style="display:inline-block;width:76px;height:76px;line-height:76px;border-radius:38px;background:${state.background};color:${state.color};font-size:40px">${state.icon}</span><p style="margin:18px 0 14px;color:${state.color};font-size:12px;font-weight:700;text-transform:uppercase">${escape(label)}</p><h1 style="margin:0 0 12px;color:#102044;font-size:27px;line-height:1.3;font-weight:700;text-align:center;overflow-wrap:anywhere">${escape(titles[data.status])}</h1><div style="font-size:15px;line-height:1.7;color:#7b8495;overflow-wrap:anywhere;white-space:pre-line">${escape(data.intro || text)}</div></div>${amount}${rows ? `<table role="presentation" width="100%" style="table-layout:fixed;border-collapse:collapse;margin-top:18px;font-family:Arial,Helvetica,sans-serif"><tr><td colspan="2" style="padding-bottom:4px;color:#102044;font-size:17px;font-weight:700">Détails de la transaction</td></tr>${rows}</table>` : ''}${data.notice ? `<p style="background:#fff4ed;border-radius:8px;margin:16px 0;padding:15px 17px;color:#70422f;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;overflow-wrap:anywhere">${escape(data.notice)}</p>` : ''}${action}<p style="margin:16px 0 0;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#8992a2;font-size:13px;line-height:1.6">Merci de votre confiance.</p>`;
}

export function renderKobaraEmail({ subject, text, html, kind, presentation }: EmailDesign) {
  const appearance = emailAppearance(subject, kind);
  const purpose = presentation?.type === 'message' ? presentation.purpose : messagePurpose(appearance, kind);
  const messageStyle = messageStyles[purpose];
  appearance.category = messageStyle.label;
  const hasHeading = html && parseDocument(html).children.some(function hasTitle(node): boolean {
    return ('name' in node && /^h[12]$/.test(node.name) && !/^kobara(?: app)?$/i.test(nodeText(node).trim()))
      || ('children' in node && node.children.some(hasTitle));
  });
  const title = hasHeading ? '' : `<h1 style="${styles.h1}">${escapeEmailHtml(presentation?.type === 'message' && presentation.heading ? presentation.heading : subject)}</h1>`;
  const codeText = appearance.security && /code/i.test(subject) ? text.replace(/\b(\d{6})\b/g, '\n$1\n') : text;
  let content = title + (html ? restyleHtml(html) : textContent(codeText));
  let variant = 'message';
  // Legacy callers keep their real code and expiry text until explicitly typed.
  const otpCodes = [...new Set(text.match(/\b\d{6}\b/g) || [])];
  const isOtp = presentation?.type === 'otp' || (appearance.security && /code/i.test(subject) && otpCodes.length === 1);
  if (isOtp) {
    variant = 'otp';
    if (presentation?.type === 'otp') {
      if (!/^\d{6}$/.test(presentation.code) || !Number.isFinite(presentation.expiresInMinutes) || presentation.expiresInMinutes <= 0) throw new Error('Invalid OTP email presentation');
      const withoutCode = text.split(presentation.code).join('');
      const otpTitles = { login: 'Confirmez votre connexion', withdrawal: 'Confirmez votre retrait', transfer: 'Confirmez votre transfert', support: 'Vérifiez votre identité auprès du support', admin: 'Confirmez votre accès Super Admin' };
      const otpPurpose = presentation.purpose;
      const details = presentation.details?.filter(detail => detail.label.trim() && detail.value.trim()).map(detail => `<tr><td style="${styles.td}">${escapeEmailHtml(detail.label)}</td><td style="${styles.td};color:#101a34;font-weight:700">${escapeEmailHtml(detail.value)}</td></tr>`).join('');
      const warning = otpPurpose === 'support'
        ? 'Saisissez ce code uniquement dans la conversation WhatsApp Kobara que vous avez initiée. Si vous n’avez pas demandé ce code, ignorez cet e-mail.'
        : 'Ne partagez ce code avec personne. Si vous n’êtes pas à l’origine de cette demande, ne l’utilisez pas et contactez le support Kobara.';
      content = `<h1 style="${styles.h1}">${escapeEmailHtml(otpPurpose ? otpTitles[otpPurpose] : subject)}</h1>${presentation.intro ? `<p style="${styles.p}">${escapeEmailHtml(presentation.intro)}</p>` : textContent(withoutCode)}${details ? `<table role="presentation" style="${styles.table}">${details}</table>` : ''}<p style="margin:22px 0 0;color:#596579;font-size:12px;text-align:center">VOTRE CODE DE VÉRIFICATION</p>${codeBlock(presentation.code)}<p style="text-align:center;color:#596579;font-size:13px;line-height:1.6">Valable pendant ${presentation.expiresInMinutes} minutes · Usage unique</p><p style="margin:24px 0 0;padding:16px;border-left:3px solid #ff6b00;background:#fff5ed;color:#70422f;font-size:13px;line-height:1.7">${warning}</p>`;
    }
  }
  if (presentation?.type === 'transaction') {
    variant = 'transaction';
    content = transactionContent(subject, text, presentation);
  }
  const internal = appearance.internal || purpose === 'internal' || (presentation?.type === 'otp' && presentation.internal);
  const securityNote = purpose === 'security' || isOtp ? '<p style="margin:20px 0 0;padding:16px;background:#f6f8fc;border-radius:8px;color:#44536e;font-size:13px;line-height:1.7">Kobara ne vous demandera jamais votre mot de passe par e-mail.</p>' : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" /><title>${escapeEmailHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#101a34;letter-spacing:0">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeEmailHtml(subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f6fa"><tr><td align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="640"><tr><td><![endif]-->
<table role="presentation" data-template="${variant}" data-purpose="${purpose}" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;table-layout:fixed;background:#ffffff;border-radius:8px;border:1px solid #e6eaf1;border-collapse:separate;overflow:hidden">
<tr><td style="height:6px;background:#f45d2c;font-size:0;line-height:6px">&nbsp;</td></tr>
<tr><td style="padding:${variant === 'transaction' ? '0 24px' : '12px 24px'};${variant !== 'transaction' ? 'border-bottom:1px solid #edf0f5' : ''}"><table role="presentation" width="100%"><tr><td><img src="https://kobara.app/logo.png" alt="Kobara" width="${variant === 'transaction' ? 170 : 200}" style="display:block;width:${variant === 'transaction' ? 170 : 200}px;max-width:100%;height:auto;border:0;color:#101a34;font-size:24px" /></td><td align="right" style="color:${variant === 'transaction' ? '#7b8495' : '#9b503b'};font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700">${internal ? 'USAGE INTERNE · SYSTEM CORE' : variant === 'transaction' ? 'REÇU DE TRANSACTION' : appearance.category}</td></tr></table></td></tr>
<tr><td style="padding:28px 24px 34px;overflow-wrap:anywhere">${variant !== 'transaction' ? `<p style="font-size:12px;line-height:1.6;font-weight:700;color:${messageStyle.color};margin:0 0 18px">${escapeEmailHtml(isOtp ? 'Vérification de sécurité' : presentation?.type === 'message' && presentation.context ? presentation.context : messageStyle.context)}</p>` : ''}${content}${securityNote}${kind === 'marketing' ? '<p style="margin:26px 0 0;border-top:1px solid #edf0f5;padding-top:18px;color:#68758a;font-size:12px;line-height:1.7">Vous recevez les actualités Kobara selon vos préférences de communication. Utilisez le lien de désabonnement de ce message pour ne plus les recevoir.</p>' : ''}</td></tr>
${variant === 'transaction' ? `<tr><td align="center" style="padding:12px 24px 26px;background:#101a34;color:#c9d2e4;font-family:Arial,Helvetica,sans-serif"><img src="https://kobara.app/logo2.png" alt="Kobara" width="160" style="display:block;width:160px;max-width:100%;height:auto;border:0;margin:0 auto;color:#ffffff;font-size:20px" /><p style="margin:0 0 10px;font-size:12px;line-height:1.7;color:#b9c3d6">Des paiements simples et sécurisés.</p><a href="https://kobara.app" style="color:#ffb18c;font-size:12px;text-decoration:none">kobara.app</a></td></tr>` : `<tr><td style="padding:18px 24px 26px;background:#101a34;color:#c9d2e4">
<img src="https://kobara.app/logo2.png" alt="Kobara" width="160" height="107" style="display:block;width:160px;max-width:100%;height:auto;border:0;margin:0 0 12px;color:#ffffff;font-size:20px" />
<p style="margin:0 0 16px;font-size:12px;line-height:1.7;color:#c9d2e4">${internal ? 'Message interne généré par Kobara System Core.<br />Ne pas transférer en dehors de l’équipe.' : 'Vos paiements, simplifiés.<br />Besoin d’aide ? <a href="mailto:support@kobara.app" style="color:#ffb18c">support@kobara.app</a>'}</p>
<p style="margin:0;font-size:12px;line-height:1.8"><a href="https://help.kobara.app" style="color:#ffb18c">Centre d’aide</a> · <a href="https://kobara.app/terms#security" style="color:#ffb18c">Sécurité</a> · <a href="https://kobara.app/privacy" style="color:#ffb18c">Confidentialité</a></p>
<p style="margin:12px 0 0;font-size:12px"><a href="https://kobara.app" style="color:#ffb18c">kobara.app</a></p></td></tr>`}</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
