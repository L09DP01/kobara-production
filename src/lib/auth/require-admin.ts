import { cookies } from "next/headers"
import { verifyAdminJwt } from "@/lib/server/admin/auth"
import { createAdminClient } from "@/utils/supabase/admin"

/**
 * Ensures the current request is from an authenticated super admin.
 * Uses the existing system-core authentication mechanism.
 */
export type AdminRole = 'super_admin' | 'operations' | 'compliance' | 'support'

export async function requireAdmin(allowedRoles?: AdminRole[]) {
  const cookieStore = await cookies()
  const token = cookieStore.get("kbr_admin_token")?.value

  if (!token) {
    throw new Error("Unauthorized - You must be logged in")
  }

  const payload = await verifyAdminJwt(token)

  if (!payload?.sub) {
    throw new Error("Forbidden - Insufficient permissions")
  }

  // Fetch the actual super_admin UUID
  const supabase = createAdminClient()
  const { data: admin } = await supabase
    .from('super_admins')
    .select('id, email, role, is_active')
    .eq('id', payload.sub)
    .single()

  if (!admin?.is_active || (allowedRoles && !allowedRoles.includes(admin.role as AdminRole))) {
    throw new Error("Unauthorized - Admin account not found")
  }

  return {
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role as AdminRole
    }
  }
}
