import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET() {
  await requireAdmin()
  const { count: criticalCount } = await supabaseAdmin.from("merchant_risk_scores").select("*", { count: 'exact', head: true }).eq("risk_level", "critical")
  const { count: highCount } = await supabaseAdmin.from("merchant_risk_scores").select("*", { count: 'exact', head: true }).eq("risk_level", "high")
  const { count: alertsCount } = await supabaseAdmin.from("risk_alerts").select("*", { count: 'exact', head: true }).eq("status", "open")
  
  return NextResponse.json({
    critical_merchants: criticalCount || 0,
    high_risk_merchants: highCount || 0,
    open_alerts: alertsCount || 0
  })
}
