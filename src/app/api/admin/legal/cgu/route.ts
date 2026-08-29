import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET() {
  await requireAdmin()
  const { data, error } = await supabaseAdmin.from("legal_documents").select("*").order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  const body = await req.json()
  
  const { data, error } = await supabaseAdmin.from("legal_documents").insert({
    doc_type: "cgu",
    version: body.version,
    title: body.title,
    content: body.content,
    content_hash: "v" + body.version + "_" + Date.now(),
    uploaded_by: session.user.id
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
