import 'server-only';

type SendResult = { messageId: string | null };

function getConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  if (!token || !phoneNumberId || !graphVersion) {
    throw new Error('WhatsApp Cloud API is not configured');
  }
  return { token, phoneNumberId, graphVersion };
}

export function getWhatsAppConfigurationStatus() {
  return {
    accessToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    graphVersion: Boolean(process.env.WHATSAPP_GRAPH_API_VERSION),
    verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    appSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
    aiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  };
}

async function graphFetch(path: string, init?: RequestInit) {
  const { token, graphVersion } = getConfig();
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const providerError = (await response.text()).slice(0, 800);
    throw new Error(`WhatsApp API ${response.status}: ${providerError}`);
  }
  return response;
}

export async function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  const { phoneNumberId } = getConfig();
  const response = await graphFetch(`${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: body.slice(0, 3900) },
    }),
  });
  const payload = await response.json() as { messages?: Array<{ id?: string }> };
  return { messageId: payload.messages?.[0]?.id || null };
}

export async function markWhatsAppMessageRead(messageId: string) {
  const { phoneNumberId } = getConfig();
  await graphFetch(`${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
  });
}

export async function downloadWhatsAppMedia(mediaId: string) {
  const metadataResponse = await graphFetch(mediaId);
  const metadata = await metadataResponse.json() as { url?: string; mime_type?: string; file_size?: number };
  if (!metadata.url) throw new Error('WhatsApp media URL missing');
  if ((metadata.file_size || 0) > 10 * 1024 * 1024) throw new Error('WhatsApp media exceeds 10 MB');

  const { token } = getConfig();
  const mediaResponse = await fetch(metadata.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!mediaResponse.ok) throw new Error(`WhatsApp media download failed: ${mediaResponse.status}`);
  const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('WhatsApp media exceeds 10 MB');
  return { bytes, mimeType: metadata.mime_type || mediaResponse.headers.get('content-type') || 'image/jpeg' };
}
