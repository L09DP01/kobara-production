"use client"
import { useEffect, useState } from "react"

export function BotStatusBadge() {
  const [status, setStatus] = useState("checking")

  useEffect(() => {
    fetch("/api/risk-watcher/health")
      .then(async r => {
        if (!r.ok) return { status: "error" }
        return r.json().catch(() => ({ status: "error" }))
      })
      .then(d => setStatus(d.status === "ok" ? "active" : "error"))
      .catch(() => setStatus("error"))
  }, [])

  return (
    <div className="flex items-center gap-2 bg-[#112240] border border-white/10 px-4 py-2 rounded-full shadow-sm">
      <div className={`relative flex h-3 w-3`}>
        {status === "active" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${status === 'active' ? 'bg-emerald-500' : status === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
      </div>
      <span className="text-sm font-medium text-slate-300">Risk Engine {status === 'active' ? 'En ligne' : 'Hors ligne'}</span>
    </div>
  )
}
