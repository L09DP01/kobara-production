import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(
    {
      error: "risk_engine_paused",
      message: "Le moteur automatique est suspendu jusqu'a la fin de sa validation.",
    },
    { status: 503 },
  )
}
