import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET() {
  await requireAdmin()
  const { data, error } = await supabaseAdmin.from("merchant_risk_scores")
    .select("merchant_id, score, risk_level, last_updated_at")
    .order("score", { ascending: false })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
