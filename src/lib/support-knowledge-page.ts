import { Parser } from 'htmlparser2';

const hosts = new Set(['kobara.app', 'docs.kobara.app', 'help.kobara.app']);

export function isPublicKnowledgeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.has(url.hostname) && !url.username && !url.password
      && (!url.port || url.port === '443') && !url.search
      && /^\/(?:$|docs(?:\/|$)|help(?:\/|$)|products(?:\/|$)|solutions(?:\/|$)|developers(?:\/|$)|resources(?:\/|$)|pricing$|terms$|privacy$)/.test(url.pathname);
  } catch { return false; }
}

export function publicPageText(html: string) {
  const excluded = new Set(['script', 'style', 'nav', 'header', 'footer', 'noscript', 'svg']);
  const hidden: boolean[] = [];
  const text: string[] = [];
  const parser = new Parser({
    onopentag(name, attrs) {
      // React streams SSR content in S:* containers before revealing it in the browser.
      const streamedContent = name === 'div' && /^S:\d+$/.test(attrs.id || '');
      hidden.push(Boolean(hidden.at(-1)) || excluded.has(name) || attrs['aria-hidden'] === 'true' || ('hidden' in attrs && !streamedContent));
    },
    ontext(value) { if (!hidden.at(-1)) text.push(value); },
    onclosetag() { hidden.pop(); text.push(' '); },
  }, { decodeEntities: true });
  parser.end(html);
  return text.join(' ').replace(/\s+/g, ' ').trim();
}

export async function readPublicKnowledgePage(value: string): Promise<string | null> {
  let url = value;
  try {
    for (let hop = 0; hop < 3; hop++) {
      if (!isPublicKnowledgeUrl(url)) return null;
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html' } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return null;
        url = new URL(location, url).href;
        continue;
      }
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || !response.body) return null;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      let html = '';
      try {
        while (true) {
          const { value: chunk, done } = await reader.read();
          if (done) break;
          size += chunk.byteLength;
          if (size > 1_000_000) return null;
          html += decoder.decode(chunk, { stream: true });
        }
        html += decoder.decode();
      } finally { await reader.cancel(); }
      const text = publicPageText(html);
      return text.length >= 100 ? text : null;
    }
  } catch { /* An unavailable public source must never become an invented answer. */ }
  return null;
}
