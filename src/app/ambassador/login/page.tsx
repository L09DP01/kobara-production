import Link from 'next/link';
import { PartnerLoginForm } from '@/components/partners/partner-login-form';

export default function AmbassadorLoginPage() {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#07101d] p-5 text-white"><section className="w-full max-w-md"><Link href="/partnership/ambassador" className="text-sm text-slate-400">← Programme Ambassadeur</Link><h1 className="mt-8 text-3xl font-black">Connexion Ambassadeur</h1><p className="mt-2 mb-8 text-slate-400">Consultez vos recommandations et récompenses.</p><PartnerLoginForm role="ambassador"/></section></main>;
}
