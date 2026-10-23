import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getAccessibleMerchants } from '@/lib/server/merchant-context';
import { switchBusinessAction } from '@/app/dashboard/businesses/actions';
import { ArrowRight } from 'lucide-react';

export default async function BusinessSelectionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const businesses = await getAccessibleMerchants(session.user.id);
  if (!businesses.length) redirect('/onboarding');

  async function selectBusiness(formData: FormData) {
    'use server';
    const result = await switchBusinessAction(String(formData.get('business_id') || ''));
    if (result.error) throw new Error(result.error);
    redirect('/dashboard');
  }

  return <main className="min-h-dvh bg-[#07101D] px-5 py-12 text-white">
    <div className="mx-auto max-w-lg">
      <img src="/logo.png" alt="Kobara" className="mb-12 h-8 w-auto" />
      <h1 className="text-2xl font-bold">Choisir un business</h1>
      <div className="mt-6 divide-y divide-slate-800 border-y border-slate-800">
        {businesses.map(b => <form action={selectBusiness} key={b.id}>
          <input type="hidden" name="business_id" value={b.id} />
          <button className="flex min-h-20 w-full items-center gap-4 py-4 text-left hover:bg-white/5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-800 font-semibold">{b.logo_url ? <img alt="" src={b.logo_url} className="h-full w-full object-cover" /> : b.business_name?.charAt(0)}</span>
            <span className="min-w-0 flex-1 break-words font-medium">{b.business_name}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-orange-400" />
          </button>
        </form>)}
      </div>
    </div>
  </main>;
}
