import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const body = await req.json()
  const { id } = await params
  
  const { data, error } = await supabaseAdmin.from("risk_alerts").update({
    status: body.status,
    resolution_note: body.resolution_note,
    resolved_by: session.user.id,
    resolved_at: body.status !== 'open' ? new Date().toISOString() : null
  }).eq("id", id).select().single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
