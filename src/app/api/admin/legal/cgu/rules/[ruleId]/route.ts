import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function PATCH(req: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  const session = await requireAdmin()
  const body = await req.json()
  const { ruleId } = await params
  
  const { data, error } = await supabaseAdmin.from("ai_derived_rules").update({
    status: body.status,
    severity: body.severity,
    risk_points: body.risk_points,
    auto_action: body.auto_action,
    rejection_reason: body.rejection_reason,
    reviewed_by: session.user.id,
    reviewed_at: new Date().toISOString()
  }).eq("id", ruleId).select().single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
