"use client"
import { useState, useEffect } from "react"

export function ActiveRulesDashboard() {
  const [rules, setRules] = useState<any[]>([])

  const fetchActiveRules = () => {
    fetch("/api/admin/legal/rules")
      .then(async r => {
        if (!r.ok) return { data: [] }
        return r.json().catch(() => ({ data: [] }))
      })
      .then(d => setRules((d.data || []).filter((r: any) => r.status === "active")))
      .catch(() => setRules([]))
  }

  useEffect(() => {
    fetchActiveRules()
    
    // Refresh periodically
    const interval = setInterval(fetchActiveRules, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-[#0A1628] border border-white/10 rounded-xl p-5 shadow-lg">
      <h2 className="text-lg font-semibold text-white mb-4">Règles Actives en Production</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg font-semibold">Nom de la règle</th>
              <th className="px-4 py-3 font-semibold">Catégorie</th>
              <th className="px-4 py-3 font-semibold">Sévérité</th>
              <th className="px-4 py-3 font-semibold">Action auto</th>
              <th className="px-4 py-3 rounded-tr-lg font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 border-b border-white/5">Aucune règle chargée pour le moment.</td></tr>
            ) : (
              rules.map(rule => (
                <tr key={rule.id} className="border-b border-white/5 bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs text-white">{rule.rule_name}</td>
                  <td className="px-4 py-3 text-xs">{rule.rule_category}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded 
                      ${rule.severity === 'critical' ? 'text-red-400 bg-red-400/10' :
                        rule.severity === 'high' ? 'text-orange-400 bg-orange-400/10' :
                        'text-blue-400 bg-blue-400/10'}`}>
                      {rule.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{rule.auto_action}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-medium">IA (v{rule.legal_doc_id.split('-')[0]})</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
