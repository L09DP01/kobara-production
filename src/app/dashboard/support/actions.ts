'use server'

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { sendEmail } from "@/lib/server/mail";
import { createSupportConversation } from "@/lib/server/support/tickets";

export async function submitSupportTicket(formData: {
  subject: string;
  category: string;
  message: string;
}) {
  try {
    const { user, merchant } = await getCurrentUserAndMerchant();
    if (!user || !merchant) throw new Error('Session marchand requise');

    const result = await createSupportConversation({
      merchantId: merchant.id,
      requesterName: merchant.business_name,
      requesterEmail: merchant.email || user.email || '',
      recipientEmail: 'support@kobara.app',
      subject: formData.subject,
      category: formData.category,
      message: formData.message,
      source: 'dashboard',
    });

    // Optionnel : Envoyer un email de confirmation au marchand
    const requesterEmail = merchant.email || user.email;
    if (!requesterEmail) throw new Error('Adresse e-mail marchand manquante');
    await sendEmail({
      to: requesterEmail,
      subject: `[${result.publicId}] Confirmation de réception`,
      text: `Bonjour ${merchant.business_name},\n\nNous avons bien reçu votre demande « ${formData.subject} ». Sa référence est ${result.publicId}.\n\nNotre équipe vous répondra dans les plus brefs délais.`,
      replyTo: 'support@kobara.app',
    });

    return { success: true, ticketId: result.ticketId, reference: result.publicId };
  } catch (error: unknown) {
    console.error("Support Ticket Error:", error);
    return { error: "Erreur lors de l'envoi de la demande de support." };
  }
}
