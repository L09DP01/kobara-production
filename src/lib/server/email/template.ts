import { parseDocument } from 'htmlparser2';

type EmailNode = ReturnType<typeof parseDocument>['children'][number];
export type EmailDesign = {
  subject: string;
  text: string;
  html?: string;
  kind?: 'transactional' | 'marketing';
  presentation?: EmailPresentation;
};

export type EmailPresentation = {
  type: 'otp';
  code: string;
  expiresInMinutes: number;
  internal?: boolean;
} | {
  type: 'transaction';
  status: 'pending' | 'approved' | 'succeeded' | 'failed' | 'rejected' | 'cancelled';
  amount?: number;
  currency?: string;
  reference?: string;
  date?: string;
  method?: string;
  merchantName?: string;
  description?: string;
  notice?: string;
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
  return `<p style="margin:28px 0;text-align:center;background:#fff5f0;border:1px solid #ffb18e;border-radius:8px;padding:24px 8px"><code style="display:inline-block;max-width:100%;box-sizing:border-box;color:#101d39;font-family:Arial,Helvetica,sans-serif;font-size:36px;line-height:1.5;font-weight:700;letter-spacing:0">${escapeEmailHtml(code)}</code></p>`;
}

const styles: Record<string, string> = {
  p: 'margin:0 0 20px;color:#555b6c;font-size:16px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere',
  h1: 'margin:0 0 24px;color:#101a34;font-size:30px;line-height:1.25;font-weight:700;text-align:left;overflow-wrap:anywhere',
  h2: 'margin:24px 0 18px;color:#161923;font-size:24px;line-height:1.3;font-weight:700;overflow-wrap:anywhere',
  h3: 'margin:24px 0 12px;color:#161923;font-size:18px;line-height:1.4;font-weight:700',
  table: 'width:100%;table-layout:fixed;border-collapse:collapse;background:#fafbfe;margin:20px 0',
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
      return `<p style="margin:24px 0;text-align:center;font-size:36px;line-height:1.3;font-weight:700;color:#161923;overflow-wrap:anywhere">${escapeEmailHtml(text)}</p>`;
    }
    const body = node.children.map(render).join('');
    if (tag === 'a') {
      const href = safeUrl(node.attribs.href || '');
      if (!href) return body;
      const isButton = /(?:background|inline-block)/i.test(node.attribs.style || '')
        && !/unsubscribe|désabonn|desabonn/i.test(text + href);
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
  return text.split(/\r?\n/).map(line => {
    if (/^\s*\d{6}\s*$/.test(line)) return codeBlock(line.trim());
    if (!line.trim()) return '<div style="height:12px;line-height:12px">&nbsp;</div>';
    const linked = line.split(/(https?:\/\/[^\s<>]+)/g).map(part => {
      const url = /^https?:\/\//.test(part) ? safeUrl(part) : '';
      return url ? `<a href="${url}" style="color:#b84a00;overflow-wrap:anywhere">${escapeEmailHtml(part)}</a>` : escapeEmailHtml(part);
    }).join('');
    return `<p style="${styles.p};margin-bottom:6px">${linked}</p>`;
  }).join('');
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
  const rows = [['Référence', data.reference], ['Date', data.date], ['Méthode', data.method], ['Bénéficiaire / marchand', data.merchantName], ['Description', data.description]]
    .filter((row): row is [string, string] => typeof row[1] === 'string' && Boolean(row[1].trim()))
    .map(([label, value]) => `<tr><td style="${styles.td};width:44%;background:#ffffff">${label}</td><td align="right" style="${styles.td};width:56%;background:#ffffff;color:#102044;font-weight:700">${escape(value)}</td></tr>`).join('');
  const amount = typeof data.amount === 'number' && Number.isFinite(data.amount) && data.amount >= 0 && data.currency
    ? `<table role="presentation" width="100%" style="background:#fafbfe;border:1px solid #e7eaf0;border-radius:8px;margin:24px 0"><tr><td align="center" style="padding:24px 12px"><p style="margin:0 0 12px;color:#7a8496;font-size:12px">MONTANT DE LA TRANSACTION</p><p style="margin:0;font-size:34px;line-height:1.3;font-weight:700;color:#102044;overflow-wrap:anywhere">${escape(data.amount.toLocaleString('fr-FR'))} ${escape(data.currency)}</p></td></tr></table>` : '';
  let actionUrl = '';
  try { const url = new URL(data.action?.url || ''); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) actionUrl = safeUrl(url.href); } catch { /* Optional CTA. */ }
  const action = actionUrl && data.action?.label.trim() ? `<p style="text-align:center;margin:26px 0"><a href="${actionUrl}" style="display:inline-block;max-width:100%;box-sizing:border-box;background:#0b1a3b;border-radius:8px;padding:15px 26px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;overflow-wrap:anywhere">${escape(data.action.label)}</a></p>` : '';
  return `<div style="text-align:center"><span style="display:inline-block;width:68px;height:68px;line-height:68px;border-radius:34px;background:${state.background};color:${state.color};font-size:36px">${state.icon}</span><p style="color:${state.color};font-size:12px;font-weight:700">${state.label}</p><h1 style="${styles.h1};color:#102044">${escape(subject)}</h1></div>${textContent(text)}${amount}${rows ? `<table role="presentation" width="100%" style="table-layout:fixed;border-collapse:collapse;margin-top:25px"><tr><td colspan="2" style="padding-bottom:13px;color:#102044;font-size:15px;font-weight:700">Détails de la transaction</td></tr>${rows}</table>` : ''}${data.notice ? `<p style="background:#fff4ed;border-left:3px solid #ed512b;padding:15px 17px;color:#70422f;font-size:13px;line-height:1.6;overflow-wrap:anywhere">${escape(data.notice)}</p>` : ''}${action}`;
}

export function renderKobaraEmail({ subject, text, html, kind, presentation }: EmailDesign) {
  const appearance = emailAppearance(subject, kind);
  const hasHeading = html && parseDocument(html).children.some(function hasTitle(node): boolean {
    return ('name' in node && /^h[12]$/.test(node.name) && !/^kobara(?: app)?$/i.test(nodeText(node).trim()))
      || ('children' in node && node.children.some(hasTitle));
  });
  const title = hasHeading ? '' : `<h1 style="${styles.h1}">${escapeEmailHtml(subject)}</h1>`;
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
      content = `<h1 style="${styles.h1}">${escapeEmailHtml(subject)}</h1>${textContent(withoutCode)}${codeBlock(presentation.code)}<p style="text-align:center;color:#9a4a30;font-size:13px">Valable pendant ${presentation.expiresInMinutes} minutes</p>`;
    }
  }
  if (presentation?.type === 'transaction') {
    variant = 'transaction';
    content = transactionContent(subject, text, presentation);
  }
  const internal = appearance.internal || (presentation?.type === 'otp' && presentation.internal);
  const securityNote = appearance.security || isOtp ? '<p style="margin:20px 0 0;padding:16px;background:#f6f8fc;border-radius:8px;color:#44536e;font-size:13px;line-height:1.7">Kobara ne vous demandera jamais votre mot de passe par e-mail.</p>' : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" /><title>${escapeEmailHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#101a34;letter-spacing:0">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeEmailHtml(subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f6fa"><tr><td align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="640"><tr><td><![endif]-->
<table role="presentation" data-template="${variant}" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;table-layout:fixed;background:#ffffff;border-radius:8px;border:1px solid #e6eaf1;border-collapse:separate;overflow:hidden">
<tr><td style="height:6px;background:#f45d2c;font-size:0;line-height:6px">&nbsp;</td></tr>
<tr><td style="padding:12px 24px;border-bottom:1px solid #edf0f5"><table role="presentation" width="100%"><tr><td><img src="https://kobara.app/logo.png" alt="Kobara" width="200" height="133" style="display:block;width:200px;max-width:100%;height:auto;border:0;color:#101a34;font-size:24px" /></td><td align="right" style="color:#9b503b;font-size:10px;font-weight:700">${internal ? 'USAGE INTERNE · SYSTEM CORE' : appearance.category}</td></tr></table></td></tr>
<tr><td style="padding:28px 24px 34px;overflow-wrap:anywhere">${variant !== 'transaction' ? `<p style="font-size:11px;font-weight:700;color:#e64c26;margin:0 0 14px">${isOtp ? 'Vérification de sécurité' : 'MESSAGE DE KOBARA'}</p>` : ''}${content}${securityNote}</td></tr>
<tr><td style="padding:18px 24px 26px;background:#101a34;color:#c9d2e4">
<img src="https://kobara.app/logo2.png" alt="Kobara" width="160" height="107" style="display:block;width:160px;max-width:100%;height:auto;border:0;margin:0 0 12px;color:#ffffff;font-size:20px" />
<p style="margin:0 0 16px;font-size:12px;line-height:1.7;color:#c9d2e4">${internal ? 'Message interne généré par Kobara System Core.<br />Ne pas transférer en dehors de l’équipe.' : 'Vos paiements, simplifiés.<br />Besoin d’aide ? <a href="mailto:support@kobara.app" style="color:#ffb18c">support@kobara.app</a>'}</p>
<p style="margin:0;font-size:12px;line-height:1.8"><a href="https://help.kobara.app" style="color:#ffb18c">Centre d’aide</a> · <a href="https://kobara.app/terms#security" style="color:#ffb18c">Sécurité</a> · <a href="https://kobara.app/privacy" style="color:#ffb18c">Confidentialité</a></p>
<p style="margin:12px 0 0;font-size:12px"><a href="https://kobara.app" style="color:#ffb18c">kobara.app</a></p></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
