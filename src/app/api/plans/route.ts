import { NextResponse } from "next/server";
import { getPlans } from "@/lib/server/plans";

export async function GET() {
  try {
    const plans = await getPlans();
    return NextResponse.json({ data: plans });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch plans" }, { status: 500 });
  }
}
