"use client"
import { useState, useEffect } from "react"
import { Check, X, Edit2, AlertCircle } from "lucide-react"

export function AIRulesValidator() {
  const [rules, setRules] = useState<any[]>([])

  const fetchPendingRules = () => {
    fetch("/api/admin/legal/rules")
      .then(async r => {
        if (!r.ok) return { data: [] }
        return r.json().catch(() => ({ data: [] }))
      })
      .then(d => setRules((d.data || []).filter((r: any) => r.status === "pending_review")))
      .catch(() => setRules([]))
  }

  useEffect(() => {
    fetchPendingRules()
  }, [])

  const handleUpdateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/legal/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    })
    fetchPendingRules()
  }

  return (
    <div className="bg-[#0A1628] border border-white/10 rounded-xl p-5 shadow-lg h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Validation des Règles IA</h2>
        <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-1 rounded-full border border-blue-500/20">
          {rules.length} en attente
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {rules.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center text-slate-500 bg-[#112240] rounded-lg border border-dashed border-white/10">
            <AlertCircle className="w-12 h-12 mb-3 text-slate-600" />
            <p className="font-medium text-slate-400">Aucune règle en attente de validation.</p>
            <p className="text-xs mt-2">Uploadez une nouvelle version des CGU et lancez l'analyse IA pour générer de nouvelles règles.</p>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-2 max-h-[600px] scrollbar-thin scrollbar-thumb-white/10">
            {rules.map(rule => (
              <div key={rule.id} className="p-4 bg-[#112240] border border-blue-500/20 rounded-lg relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50"></div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-white font-medium">{rule.rule_name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono bg-black/20 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {rule.rule_category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded font-bold">
                      +{rule.risk_points} pts
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-slate-300 mb-3">{rule.description}</p>
                
                <div className="bg-black/30 p-3 rounded border border-white/5 mb-4">
                  <p className="text-xs font-mono text-emerald-400/80 mb-1">Base légale (CGU) :</p>
                  <p className="text-xs text-slate-400 italic">"{rule.legal_basis}"</p>
                </div>

                <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors">
                    <Edit2 className="w-3.5 h-3.5" /> Ajuster
                  </button>
                  <button onClick={() => handleUpdateStatus(rule.id, "rejected")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-white hover:bg-red-500 rounded transition-colors bg-red-500/10">
                    <X className="w-3.5 h-3.5" /> Rejeter
                  </button>
                  <button onClick={() => handleUpdateStatus(rule.id, "active")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-white hover:bg-emerald-500 rounded transition-colors bg-emerald-500/10">
                    <Check className="w-3.5 h-3.5" /> Approuver
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
