import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("kbr_admin_token");
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("kbr_admin_token");
  return NextResponse.redirect(new URL("/system-core/login", request.url));
}
