import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  encryptShopifyAccessToken,
  exchangeShopifyAuthorizationCode,
  getShopifyConfig,
  getShopifyShopIdentity,
  hashShopifyOAuthNonce,
  hasRequiredShopifyScopes,
  normalizeShopDomain,
  parseShopifyNumericId,
  registerShopifyWebhooks,
  safeShopifyOAuthFailure,
  verifyShopifyOAuthHmac,
  verifyShopifyOAuthState,
} from '@/lib/server/shopify';

export const dynamic = 'force-dynamic';

function dashboardRedirect(path: string) {
  return NextResponse.redirect(new URL(path, getShopifyConfig().appUrl));
}

function telegramRedirect() {
  const username = (process.env.TELEGRAM_BOT_USERNAME || 'KobaraPayBot').replace(/^@/, '');
  return NextResponse.redirect(`https://t.me/${username}`);
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let stage = 'verify_signature';
  let pendingId: string | null = null;
  let accessToken: string | null = null;
  try {
    if (!verifyShopifyOAuthHmac(params)) throw new Error('invalid_hmac');
    const code = params.get('code');
    const stateRaw = params.get('state');
    const requestedShop = normalizeShopDomain(params.get('shop') || '');
    if (!code || !stateRaw) throw new Error('missing_oauth_parameters');

    stage = 'verify_state';
    const state = await verifyShopifyOAuthState(stateRaw);
    if (state.shopDomain !== requestedShop) throw new Error('shop_mismatch');

    stage = 'load_session';
    const supabase = createAdminClient();
    const { data: pending, error: pendingError } = await supabase
      .from('shopify_installations')
      .select('id, merchant_id, oauth_state_hash')
      .eq('merchant_id', state.merchantId)
      .eq('shop_domain', requestedShop)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingError || !pending) throw new Error('oauth_session_not_found');
    if (pending.oauth_state_hash !== hashShopifyOAuthNonce(state.nonce)) throw new Error('state_replayed');
    pendingId = pending.id;

    const { data: merchant } = await supabase.from('merchants').select('kyc_status')
      .eq('id', state.merchantId).maybeSingle();
    if (merchant?.kyc_status !== 'approved') throw new Error('kyc_required');

    stage = 'exchange_token';
    const token = await exchangeShopifyAuthorizationCode(requestedShop, code);
    accessToken = token.accessToken;
    if (!hasRequiredShopifyScopes(token.scopes)) throw new Error('missing_scopes');
    stage = 'read_shop';
    const shop = await getShopifyShopIdentity(requestedShop, token.accessToken);
    stage = 'register_webhooks';
    const webhooks = await registerShopifyWebhooks(requestedShop, token.accessToken);
    stage = 'save_installation';
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from('shopify_installations').update({
      shop_domain: normalizeShopDomain(shop.myshopifyDomain),
      shop_id: parseShopifyNumericId(shop.id),
      shop_name: shop.name,
      shop_email: shop.email,
      status: 'active',
      access_token_ciphertext: encryptShopifyAccessToken(token.accessToken),
      granted_scopes: token.scopes,
      oauth_state_hash: null,
      installed_at: now,
      disconnected_at: null,
      uninstalled_at: null,
      last_error: null,
      metadata: { webhook_subscriptions: webhooks },
      updated_at: now,
    }).eq('id', pending.id);
    if (updateError) throw new Error(updateError.message);

    await Promise.allSettled([
      supabase.from('audit_logs').insert({
        merchant_id: pending.merchant_id,
        action: 'shopify.connected',
        entity_type: 'shopify_installation',
        entity_id: pending.id,
        metadata: { shop_domain: requestedShop, scopes: token.scopes },
      }),
      supabase.from('notifications').insert({
        merchant_id: pending.merchant_id,
        type: 'shopify_connected',
        title: 'Shopify connecté',
        message: `La boutique ${shop.name} est connectée à Kobara.`,
      }),
    ]);

    if (state.source === 'telegram' && state.telegramChatId) {
      const { data: telegramLink } = await supabase
        .from('merchant_telegram_accounts')
        .select('telegram_chat_id')
        .eq('merchant_id', pending.merchant_id)
        .eq('telegram_chat_id', state.telegramChatId)
        .maybeSingle();
      if (telegramLink) {
        const { TelegramClient } = await import('@/lib/server/telegram/telegram-client');
        await TelegramClient.sendMessage(
          state.telegramChatId,
          `✅ <b>Shopify connecté avec succès</b>\n\nLa boutique <b>${escapeTelegramHtml(shop.name)}</b> est maintenant reliée à Kobara. Les moyens de paiement autorisés sur votre compte seront utilisés.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Voir Shopify', url: `${getShopifyConfig().appUrl}/integrations/shopify` }],
                [{ text: '🏠 Menu principal', callback_data: 'action:main_menu' }],
              ],
            },
          }
        );
      }
      return telegramRedirect();
    }

    return dashboardRedirect('/integrations/shopify?connected=1');
  } catch (error) {
    const knownCodes = ['invalid_hmac', 'missing_oauth_parameters', 'shop_mismatch', 'oauth_session_not_found', 'state_replayed', 'kyc_required', 'missing_scopes', 'oauth_token_missing'];
    const code = error instanceof Error && (knownCodes.includes(error.message) || /^oauth_token_http_[1-5]\d{2}$/.test(error.message))
      ? error.message : error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name) ? 'oauth_timeout' : stage;
    // Never log OAuth codes, state, access tokens, raw upstream errors or URLs.
    console.error('[Shopify] OAuth callback failed.', {
      stage, code,
      detail: safeShopifyOAuthFailure(error, [...params.values(), ...(accessToken ? [accessToken] : [])]),
    });
    if (pendingId) {
      try {
        await createAdminClient().from('shopify_installations').update({ last_error: `oauth:${code}` })
          .eq('id', pendingId).eq('status', 'pending');
      } catch { /* Diagnostics must not break the safe redirect. */ }
    }
    return dashboardRedirect('/integrations/shopify?error=callback_failed');
  }
}
