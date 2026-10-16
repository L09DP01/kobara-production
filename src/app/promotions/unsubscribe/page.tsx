import { redirect } from 'next/navigation';
import { validPromotionToken } from '@/lib/smart-promotions';
import { promotionSecret } from '@/lib/server/messaging/smart-promotions';
import { createAdminClient } from '@/utils/supabase/admin';

async function unsubscribe(token: string) {
  'use server';
  const id = validPromotionToken(token, promotionSecret());
  if (!id) throw new Error('Lien invalide.');
  const { error } = await createAdminClient().rpc('suppress_smart_promotion', { p_recipient: id });
  if (error) throw new Error('Désabonnement temporairement indisponible. Réessayez.');
  redirect('/promotions/unsubscribe?done=1');
}
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const params = await searchParams;
  const valid = params.token && validPromotionToken(params.token, promotionSecret());
  return <main className="grid min-h-[100dvh] place-items-center bg-[#F4F6F8] px-6 text-[#10131D]"><div className="max-w-md"><h1 className="text-2xl font-bold">Préférences e-mail Kobara</h1>
    {params.done ? <p className="mt-4">Les promotions sont désactivées. Les messages nécessaires au fonctionnement et à la sécurité de votre compte restent actifs.</p> : valid ? <form action={unsubscribe.bind(null, params.token!)}><p className="mt-4 leading-7">Confirmez pour ne plus recevoir de promotions Kobara à cette adresse.</p><button className="mt-6 min-h-12 rounded-md bg-[#F45D2C] px-5 font-bold text-white">Me désabonner des promotions</button></form> : <p className="mt-4">Ce lien n’est pas valide. Vous pouvez modifier vos préférences dans les paramètres de votre compte.</p>}
  </div></main>;
}
