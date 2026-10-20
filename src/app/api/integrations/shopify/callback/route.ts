import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  encryptShopifyAccessToken,
  exchangeShopifyAuthorizationCode,
  getShopifyConfig,
  getShopifyShopIdentity,
  hashShopifyOAuthNonce,
  normalizeShopDomain,
  parseShopifyNumericId,
  registerShopifyWebhooks,
  SHOPIFY_SCOPES,
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
  try {
    if (!verifyShopifyOAuthHmac(params)) throw new Error('invalid_hmac');
    const code = params.get('code');
    const stateRaw = params.get('state');
    const requestedShop = normalizeShopDomain(params.get('shop') || '');
    if (!code || !stateRaw) throw new Error('missing_oauth_parameters');

    const state = await verifyShopifyOAuthState(stateRaw);
    if (state.shopDomain !== requestedShop) throw new Error('shop_mismatch');

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

    const { data: merchant } = await supabase.from('merchants').select('kyc_status')
      .eq('id', state.merchantId).maybeSingle();
    if (merchant?.kyc_status !== 'approved') throw new Error('kyc_required');

    const token = await exchangeShopifyAuthorizationCode(requestedShop, code);
    if (!SHOPIFY_SCOPES.every(scope => token.scopes.includes(scope))) throw new Error('missing_scopes');
    const shop = await getShopifyShopIdentity(requestedShop, token.accessToken);
    const webhooks = await registerShopifyWebhooks(requestedShop, token.accessToken);
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
  } catch {
    console.error('[Shopify] OAuth callback failed.');
    return dashboardRedirect('/integrations/shopify?error=callback_failed');
  }
}
