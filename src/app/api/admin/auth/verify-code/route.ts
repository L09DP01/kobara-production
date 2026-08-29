import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOtp } from "@/lib/server/admin/auth";
import { cookies } from "next/headers";
import { logAdminAudit } from "@/lib/server/admin/audit";

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json({ error: "Email et code requis" }, { status: 400 });
    }

    const result = await verifyAdminOtp(email, code);

    if (!result.success || !result.token) {
      await logAdminAudit('admin_login_failed', { email, reason: result.error || "Code invalide" });
      return NextResponse.json({ error: result.error || "Code invalide" }, { status: 401 });
    }

    // Set secure session cookie (No Max-Age/Expires so it is cleared on browser close)
    const cookieStore = await cookies();
    cookieStore.set("kbr_admin_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    await logAdminAudit('admin_login_success', { email }, result.adminId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur verify-code admin:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
