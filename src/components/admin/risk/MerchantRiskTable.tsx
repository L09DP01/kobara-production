"use client"
import { useEffect, useState } from "react"

export function MerchantRiskTable() {
  const [merchants, setMerchants] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/admin/risk/merchants")
      .then(async r => {
        if (!r.ok) return { data: [] }
        return r.json().catch(() => ({ data: [] }))
      })
      .then(d => setMerchants(d.data || []))
      .catch(() => setMerchants([]))
  }, [])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-300">
        <thead className="text-xs uppercase bg-white/5 text-slate-400">
          <tr>
            <th className="px-4 py-3 rounded-tl-lg">ID Marchand</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Niveau</th>
            <th className="px-4 py-3">Dernière maj</th>
            <th className="px-4 py-3 rounded-tr-lg">Action</th>
          </tr>
        </thead>
        <tbody>
          {merchants.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun marchand avec un score de risque.</td></tr>
          )}
          {merchants.map((m) => (
            <tr key={m.merchant_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">{m.merchant_id}</td>
              <td className="px-4 py-3 font-bold">{m.score}</td>
              <td className="px-4 py-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border
                  ${m.risk_level === 'critical' || m.risk_level === 'suspended' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                    m.risk_level === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
                    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                  {m.risk_level}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-400">{new Date(m.last_updated_at).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <button className="text-[#FF4A1C] hover:text-white transition-colors text-xs font-medium bg-[#FF4A1C]/10 hover:bg-[#FF4A1C] px-3 py-1.5 rounded">Détails</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
