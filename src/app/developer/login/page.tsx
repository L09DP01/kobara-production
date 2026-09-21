import Link from 'next/link';
import { PartnerLoginForm } from '@/components/partners/partner-login-form';

export default function DeveloperLoginPage() {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#07101d] p-5 text-white"><section className="w-full max-w-md"><Link href="/developer" className="text-sm text-slate-400">← Programme Developer</Link><h1 className="mt-8 text-3xl font-black">Connexion Developer</h1><p className="mt-2 mb-8 text-slate-400">Gérez vos clients, intégrations et commissions.</p><PartnerLoginForm role="developer"/><p className="mt-6 text-center text-sm text-slate-400">Pas encore inscrit ? <Link href="/developer/register" className="font-bold text-orange-400">Créer un compte</Link></p></section></main>;
}
