'use server'

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { sendEmail } from "@/lib/server/mail";
import { createAdminClient } from "@/utils/supabase/admin";

export async function submitSupportTicket(formData: {
  subject: string;
  category: string;
  message: string;
}) {
  try {
    const { user, merchant } = await getCurrentUserAndMerchant();
    
    const adminClient = createAdminClient();
    const { data: ticket, error: ticketError } = await adminClient
      .from('support_tickets')
      .insert({
        merchant_id: merchant.id,
        subject: formData.subject.trim(),
        category: formData.category,
        status: 'pending_admin',
        priority: 'normal',
      })
      .select('id')
      .single();

    if (ticketError || !ticket) throw new Error(ticketError?.message || 'Ticket creation failed');

    const { error: messageError } = await adminClient.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_type: 'merchant',
      message: formData.message.trim(),
    });
    if (messageError) throw new Error(messageError.message);

    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@kobara.app';
    
    const emailText = `
Nouveau ticket de support de la part de :
Marchand : ${merchant.business_name} (${merchant.id})
Email : ${merchant.email || user.email}
Téléphone : ${merchant.phone || 'Non renseigné'}
Catégorie : ${formData.category}

Message :
${formData.message}
    `;

    await sendEmail({
      to: supportEmail,
      subject: `[Support - ${formData.category}] ${formData.subject}`,
      text: emailText
    });

    // Optionnel : Envoyer un email de confirmation au marchand
    await sendEmail({
      to: merchant.email || user.email,
      subject: `Confirmation de réception : ${formData.subject}`,
      text: `Bonjour ${merchant.business_name},\n\nNous avons bien reçu votre demande de support concernant "${formData.subject}".\n\nNotre équipe vous répondra dans les plus brefs délais.\n\nRappel de votre message :\n${formData.message}`
    });

    return { success: true, ticketId: ticket.id };
  } catch (error: unknown) {
    console.error("Support Ticket Error:", error);
    return { error: "Erreur lors de l'envoi de la demande de support." };
  }
}
