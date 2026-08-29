import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';

export async function incrementPromoCodeUsage(promoCodeId?: string | null) {
  if (!promoCodeId) return;

  const supabase = createAdminClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: promo, error: readError } = await supabase
      .from('promo_codes')
      .select('current_uses, max_uses, is_active')
      .eq('id', promoCodeId)
      .single();

    if (readError || !promo) {
      throw new Error(`Impossible de retrouver le code promo: ${readError?.message || 'introuvable'}`);
    }

    const currentUses = Number(promo.current_uses || 0);
    if (!promo.is_active || (promo.max_uses && currentUses >= Number(promo.max_uses))) {
      throw new Error("Ce code promo n'est plus disponible.");
    }

    const { data: updated, error: updateError } = await supabase
      .from('promo_codes')
      .update({ current_uses: currentUses + 1, updated_at: new Date().toISOString() })
      .eq('id', promoCodeId)
      .eq('current_uses', currentUses)
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new Error(`Impossible d'enregistrer le code promo: ${updateError.message}`);
    }
    if (updated) return;
  }

  throw new Error("Le code promo vient d'être utilisé. Veuillez réessayer.");
}
