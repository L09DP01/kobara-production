import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { analyzeCGU } from "@/lib/ai/cgu-analyzer"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  
  const { data: doc } = await supabaseAdmin.from("legal_documents").select("*").eq("id", id).single()
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })

  await supabaseAdmin.from("legal_documents").update({ analysis_status: "analyzing" }).eq("id", doc.id)

  try {
    const rules = await analyzeCGU(doc.content, doc.version)
    
    for (const rule of rules) {
      await supabaseAdmin.from("ai_derived_rules").insert({
        legal_doc_id: doc.id,
        rule_name: rule.rule_name,
        rule_category: rule.rule_category,
        description: rule.description,
        legal_basis: rule.legal_basis,
        severity: rule.severity,
        risk_points: rule.risk_points,
        auto_action: rule.auto_action,
        detection_logic: rule.detection_logic,
        status: "pending_review"
      })
    }

    await supabaseAdmin.from("legal_documents").update({ 
      analysis_status: "done",
      rules_generated: rules.length,
      analyzed_at: new Date().toISOString()
    }).eq("id", doc.id)

    return NextResponse.json({ success: true, rules_generated: rules.length })
  } catch (err) {
    await supabaseAdmin.from("legal_documents").update({ analysis_status: "failed" }).eq("id", doc.id)
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }
}
