import { CGUVersionManager } from "@/components/admin/legal/CGUVersionManager"
import { AIRulesValidator } from "@/components/admin/legal/AIRulesValidator"
import { ActiveRulesDashboard } from "@/components/admin/legal/ActiveRulesDashboard"

export const metadata = {
  title: 'Moteur CGU IA | Kobara Admin',
}

export default function CGURulesPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="border-b border-white/5 pb-5">
        <h1 className="text-3xl font-bold text-white tracking-tight">Moteur CGU (Intelligence Artificielle)</h1>
        <p className="text-slate-400 mt-1">Générez automatiquement des règles de détection à partir des Conditions Générales d'Utilisation.</p>
      </div>

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
