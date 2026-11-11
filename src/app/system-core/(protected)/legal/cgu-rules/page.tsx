import { CGUVersionManager } from "@/components/admin/legal/CGUVersionManager"
import { AIRulesValidator } from "@/components/admin/legal/AIRulesValidator"
import { ActiveRulesDashboard } from "@/components/admin/legal/ActiveRulesDashboard"
import { Upload } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getPublishedCgu } from '@/lib/server/cgu-publication'
import { importAndPublishCgu } from './publication-actions'

export const metadata = {
  title: 'Moteur CGU IA | Kobara Admin',
}

export default async function CGURulesPage() {
  const session = await requireAdmin()
  const published = await getPublishedCgu()
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="border-b border-white/5 pb-5">
        <h1 className="text-3xl font-bold text-white tracking-tight">Moteur CGU (Intelligence Artificielle)</h1>
        <p className="text-slate-400 mt-1">Générez automatiquement des règles de détection à partir des Conditions Générales d'Utilisation.</p>
      </div>

      <section className="space-y-4 border-b border-white/10 pb-6">
        <h2 className="text-lg font-bold">CGU publiques</h2>
        <p className="text-sm text-slate-300">{published ? `Version ${published.version} · Dernière mise à jour : ${new Date(published.published_at).toLocaleDateString('fr-HT', { timeZone: 'America/Port-au-Prince' })}` : 'Version du site · Aucune publication depuis System Core'}</p>
        {session.user.role === 'super_admin' && <form action={importAndPublishCgu} className="grid max-w-xl gap-4">
          <label className="grid gap-1 text-sm">Version<input required name="version" maxLength={40} className="rounded border border-slate-600 bg-slate-950 p-2" /></label>
          <label className="grid gap-1 text-sm">Titre<input required name="title" maxLength={160} className="rounded border border-slate-600 bg-slate-950 p-2" /></label>
          <label className="grid gap-1 text-sm">Document complet (.txt ou .md)<input required name="document" type="file" accept=".txt,.md" className="text-sm" /></label>
          <label className="flex items-start gap-2 text-sm"><input required name="confirm" type="checkbox" className="mt-1" />Je confirme le remplacement des CGU publiques et la mise en file d’attente des avis aux marchands.</label>
          <button type="submit" className="inline-flex w-fit items-center gap-2 rounded bg-orange-600 px-4 py-2 text-sm font-bold text-white"><Upload size={16} aria-hidden />Importer et publier</button>
        </form>}
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <CGUVersionManager />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <AIRulesValidator />
        </div>
      </div>

      <div className="pt-6 border-t border-white/10">
        <ActiveRulesDashboard />
      </div>
    </div>
  )
}
