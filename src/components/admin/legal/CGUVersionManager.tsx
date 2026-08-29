"use client"
import { useState, useEffect } from "react"
import { Upload, RefreshCw } from "lucide-react"

export function CGUVersionManager() {
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState("")
  const [version, setVersion] = useState("")
  const [title, setTitle] = useState("")

  const fetchDocs = () => {
    fetch("/api/admin/legal/cgu")
      .then(async r => {
        if (!r.ok) return { data: [] }
        return r.json().catch(() => ({ data: [] }))
      })
      .then(d => setDocs(d.data || []))
      .catch(() => setDocs([]))
  }

  useEffect(() => { fetchDocs() }, [])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch("/api/admin/legal/cgu", {
      method: "POST",
      body: JSON.stringify({ version, title, content: text })
    })
    setText(""); setVersion(""); setTitle("")
    fetchDocs()
    setLoading(false)
  }

  const handleAnalyze = async (id: string) => {
    setLoading(true)
    await fetch(`/api/admin/legal/cgu/${id}/analyze`, { method: "POST" })
    fetchDocs()
    setLoading(false)
  }

  return (
    <div className="bg-[#0A1628] border border-white/10 rounded-xl p-5 shadow-lg">
      <h2 className="text-lg font-semibold text-white mb-4">Versions CGU</h2>
      
      <form onSubmit={handleUpload} className="mb-6 space-y-3 p-4 bg-[#112240] rounded-lg border border-white/5">
        <h3 className="text-sm font-medium text-slate-300">Nouvelle version</h3>
        <div className="flex gap-2">
          <input required placeholder="Version (ex: 1.2)" value={version} onChange={e=>setVersion(e.target.value)} className="w-1/3 bg-[#0A1628] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
          <input required placeholder="Titre du document" value={title} onChange={e=>setTitle(e.target.value)} className="flex-1 bg-[#0A1628] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
        </div>
        <textarea required placeholder="Collez le texte intégral des CGU ici..." value={text} onChange={e=>setText(e.target.value)} className="w-full h-32 bg-[#0A1628] border border-white/10 rounded px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500 scrollbar-thin scrollbar-thumb-white/10" />
        <button disabled={loading} className="w-full bg-[#FF4A1C] hover:bg-[#FF4A1C]/90 text-white rounded py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
          <Upload className="w-4 h-4" /> Uploader
        </button>
      </form>

      <div className="space-y-3">
        {docs.map(doc => (
          <div key={doc.id} className="flex flex-col xl:flex-row xl:items-center justify-between p-3.5 border border-white/5 bg-[#112240] rounded-lg">
            <div className="mb-3 xl:mb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-medium text-sm">v{doc.version}</span>
                {doc.is_active && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">En vigueur</span>}
              </div>
              <p className="text-xs text-slate-400 font-medium">{doc.title}</p>
              <p className="text-[10px] text-slate-500 mt-1">{new Date(doc.created_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center justify-between xl:justify-end gap-3 w-full xl:w-auto bg-[#0A1628] p-2 rounded">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Statut Analyse</span>
                <span className={`text-xs font-medium ${doc.analysis_status === 'done' ? 'text-emerald-400' : doc.analysis_status === 'failed' ? 'text-red-400' : 'text-blue-400'}`}>
                  {doc.analysis_status === 'done' ? `${doc.rules_generated} règles` : doc.analysis_status}
                </span>
              </div>
              {(doc.analysis_status === 'pending' || doc.analysis_status === 'failed') && (
                <button onClick={() => handleAnalyze(doc.id)} disabled={loading} className="p-2 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors" title="Lancer l'analyse IA (Gemini)">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Aucun document.</p>}
      </div>
    </div>
  )
}
