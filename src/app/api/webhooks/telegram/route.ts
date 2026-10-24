import { NextResponse } from 'next/server';
import { TelegramBotService } from '@/lib/server/telegram/telegram-bot.service';
import { TelegramClient } from '@/lib/server/telegram/telegram-client';
import { isTelegramWebhookAuthorized } from '@/lib/telegram-webhook-security';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!configuredSecret) return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 });
    if (!isTelegramWebhookAuthorized(configuredSecret, secretHeader)) {
      console.warn('[TelegramWebhook] Invalid secret token received');
      return NextResponse.json({ error: 'Unauthorized secret token' }, { status: 401 });
    }

    const update = await request.json();
    await TelegramBotService.handleUpdate(update);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[TelegramWebhook] Error handling update.', { type: error instanceof Error ? error.name : 'unknown' });
    return NextResponse.json({ ok: true }); // Toujours 200 à Telegram pour éviter les boucles d'erreurs
  }
}

export async function GET(request: Request) {
  try { await requireAdmin(['super_admin', 'operations']); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const url = new URL(request.url);
  const isAutoSetup = url.searchParams.get('setup') === 'auto' || url.searchParams.get('set_webhook') === 'true';

  const botToken = TelegramClient.getBotToken();
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (isAutoSetup && !configuredSecret) return NextResponse.json({ error: 'Configure TELEGRAM_WEBHOOK_SECRET before setup' }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
  const webhookUrl = `${appUrl}/api/webhooks/telegram`;

  let webhookResult: any = null;
  let botInfo: any = null;
  let currentWebhook: any = null;

  if (botToken) {
    botInfo = await TelegramClient.getMe();
    currentWebhook = await TelegramClient.getWebhookInfo();

    if (isAutoSetup) {
      webhookResult = await TelegramClient.setWebhook(webhookUrl, configuredSecret);
      currentWebhook = await TelegramClient.getWebhookInfo();
    }
  }

  return NextResponse.json({
    service: 'Kobara Telegram Bot Webhook Service',
    status: botToken ? 'ready' : 'token_missing',
    tokenConfigured: !!botToken,
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'KobaraBot',
    expectedWebhookUrl: webhookUrl,
    telegramBotInfo: botInfo,
    currentTelegramWebhookInfo: currentWebhook,
    autoSetupExecuted: isAutoSetup,
    setupResult: webhookResult,
    instructions: !botToken
      ? "Ajoutez TELEGRAM_BOT_TOKEN=<votre_token_botfather> dans vos variables d'environnement (.env / Vercel)."
      : currentWebhook?.result?.url !== webhookUrl
      ? `Pour enregistrer le webhook, visitez : ${appUrl}/api/webhooks/telegram?setup=auto`
      : "Le webhook est correctement configuré et actif sur Telegram !",
  });
}
