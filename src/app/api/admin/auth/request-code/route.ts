import { NextRequest, NextResponse } from "next/server";
import { generateAdminOtp } from "@/lib/server/admin/auth";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    await generateAdminOtp(email);

    // Toujours retourner success pour éviter le data mining (énumération d'emails)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur request-code admin:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
