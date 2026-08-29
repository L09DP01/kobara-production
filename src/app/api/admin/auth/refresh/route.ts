import { NextRequest, NextResponse } from "next/server";
import { refreshAdminJwt } from "@/lib/server/admin/auth";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("kbr_admin_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const newToken = await refreshAdminJwt(token);

    if (!newToken) {
      // Si le token est expiré ou invalide, on force la déconnexion
      cookieStore.delete("kbr_admin_token");
      return NextResponse.json({ error: "Session expirée" }, { status: 401 });
    }

    // Prolonger la session de 5 minutes côté serveur (le cookie reste un session cookie)
    cookieStore.set("kbr_admin_token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
