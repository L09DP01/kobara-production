import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import crypto from 'crypto';
import { sendWelcomeEmail } from '@/lib/server/mail';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logAdminAudit } from '@/lib/server/admin/audit';

export async function POST() {
  const session = await requireAdmin(['super_admin', 'operations']);
  const supabase = createAdminClient();
  const results = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';

  try {
    // 1. Fetch all unverified users whose token has expired
    const now = new Date().toISOString();
    const { data: expiredUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email_verified', false)
      .lt('verification_token_expires', now)
      .limit(50);

    if (fetchError) {
      throw new Error(`Database error: ${fetchError.message}`);
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      return NextResponse.json({ success: true, message: "Aucun utilisateur avec un jeton expiré trouvé.", results: [] });
    }

    // 2. Loop through them to generate new tokens and send emails
    for (const user of expiredUsers) {
      const email = user.email;
      try {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { error: updateError } = await supabase
          .from('users')
          .update({
            verification_token: token,
            verification_token_expires: tokenExpires
          })
          .eq('id', user.id);

        if (updateError) {
          results.push({ email, status: 'error', reason: 'DB update failed' });
          continue;
        }

        const verificationLink = `${appUrl}/api/auth/verify-email?token=${token}`;

        await sendWelcomeEmail({
          to: email,
          verificationLink
        });

        results.push({ email, status: 'success' });
      } catch (error: unknown) {
        results.push({ email, status: 'error', reason: error instanceof Error ? error.message : 'Erreur inconnue' });
      }
    }

    await logAdminAudit('users.verification_emails_repaired', {
      processed: results.length,
      sent: results.filter(r => r.status === 'success').length,
    }, session.user.id);

    return NextResponse.json({ 
      success: true, 
      message: `${results.filter(r => r.status === 'success').length} e-mails renvoyés avec succès.`,
      results 
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erreur interne' }, { status: 500 });
  }
}
