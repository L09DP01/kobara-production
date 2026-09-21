/* eslint-disable @typescript-eslint/no-explicit-any -- Referral rows use the server-managed Supabase schema. */
import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { createAdminClient } from '@/utils/supabase/admin';
import { PartnerActionForm } from '@/components/partners/partner-action-form';
import { inviteMerchantFriend } from './actions';

export default async function MerchantReferralsPage() {
  const { merchant } = await getCurrentUserAndMerchant();
  const supabase = createAdminClient();
  const { data } = await supabase.from('merchant_referrals')
    .select('id,invited_email,status,qualifying_htg_total,qualifying_usd_total,created_at')
    .eq('referrer_merchant_id', merchant.id).order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="text-3xl font-black">Parrainage</h1>
      <p className="mt-2 max-w-3xl text-slate-400">
        Recevez 675 Gdes lorsque votre invité active Pro et atteint 10 000 HTG ou 50 USD de paiements confirmés. Votre entreprise doit aussi avoir encaissé au moins 1 500 HTG via ses propres liens ou clés API.
      </p>
      <section className="mt-7 border-y border-slate-800 py-5">
        <PartnerActionForm action={inviteMerchantFriend} submitLabel="Envoyer l’invitation" className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="email" type="email" required placeholder="ami@entreprise.com" className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3" />
        </PartnerActionForm>
      </section>
      <section className="mt-7 overflow-x-auto rounded-md border border-slate-800">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-slate-900 text-slate-400"><tr><th className="p-4">Invité</th><th>Statut</th><th>Volume HTG</th><th>Volume USD</th><th>Récompense</th></tr></thead>
          <tbody>{(data || []).map((referral: any) => (
            <tr key={referral.id} className="border-t border-slate-800">
              <td className="p-4">{referral.invited_email}</td><td>{referral.status}</td><td>{referral.qualifying_htg_total} / 10000</td><td>{referral.qualifying_usd_total} / 50</td><td>675 HTG</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}
