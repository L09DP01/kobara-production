import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    {
      status: "paused",
      service: "Kobara Risk Watcher",
      enabled: false,
      reason: "Le moteur automatique est suspendu jusqu'a la fin de sa validation.",
    },
    { status: 503 },
  )
}
