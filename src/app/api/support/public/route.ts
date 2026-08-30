import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/server/mail';
import { verifyTurnstileToken } from '@/lib/server/security/turnstile';
import { createSupportConversation } from '@/lib/server/support/tickets';

const supportSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  subject: z.string().trim().min(1).max(255),
  category: z.enum(['support', 'sales', 'partnership', 'other']),
  message: z.string().trim().min(10).max(10_000),
  turnstileToken: z.string().min(1),
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = supportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Vérifiez les informations du formulaire.' },
        { status: 400 },
      );
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || undefined;
    const humanCheck = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
    if (!humanCheck.success) {
      return NextResponse.json({ error: humanCheck.error }, { status: 400 });
    }

    const result = await createSupportConversation({
      requesterName: `${parsed.data.firstName} ${parsed.data.lastName}`,
      requesterEmail: parsed.data.email,
      recipientEmail: 'contact@kobara.app',
      subject: parsed.data.subject,
      category: parsed.data.category,
      message: parsed.data.message,
      source: 'public_contact',
    });

    await sendEmail({
      to: parsed.data.email,
      subject: `[${result.publicId}] Demande reçue par Kobara`,
      text: `Bonjour ${parsed.data.firstName},\n\nVotre demande a bien été enregistrée sous la référence ${result.publicId}. Notre équipe vous répondra par e-mail.\n\nSujet : ${parsed.data.subject}`,
      replyTo: 'support@kobara.app',
    });

    return NextResponse.json({ success: true, reference: result.publicId });
  } catch (error) {
    console.error('Public support ticket error:', error);
    return NextResponse.json(
      { error: "Impossible d'envoyer votre message pour le moment." },
      { status: 500 },
    );
  }
}
