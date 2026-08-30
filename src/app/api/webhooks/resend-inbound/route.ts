import { NextRequest, NextResponse } from 'next/server';
import {
  createSupportConversation,
  extractDisplayName,
  isSupportRecipient,
  normalizeEmailAddress,
} from '@/lib/server/support/tickets';
import {
  htmlToPlainText,
  retrieveReceivedEmail,
  verifyResendWebhook,
} from '@/lib/server/support/resend-webhook';

type EmailReceivedEvent = {
  type: 'email.received';
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    message_id?: string;
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyResendWebhook(rawBody, request.headers)) {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
  }

  let event: EmailReceivedEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 });
  }

  if (event.type !== 'email.received') {
    return NextResponse.json({ received: true });
  }

  try {
    const recipient = event.data.to
      .map(normalizeEmailAddress)
      .find(isSupportRecipient);
    if (!recipient) return NextResponse.json({ received: true, ignored: true });

    const email = await retrieveReceivedEmail(event.data.email_id);
    const senderEmail = normalizeEmailAddress(email.from || event.data.from);
    if (isSupportRecipient(senderEmail) || senderEmail.endsWith('@kobara.app')) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const message = (email.text || (email.html ? htmlToPlainText(email.html) : '')).trim();
    if (!message) throw new Error('E-mail entrant sans contenu exploitable');

    const result = await createSupportConversation({
      requesterName: extractDisplayName(email.headers?.from || email.from),
      requesterEmail: senderEmail,
      recipientEmail: recipient,
      subject: email.subject || event.data.subject || 'Message reçu par e-mail',
      category: 'email',
      message,
      source: 'inbound_email',
      externalMessageId: email.message_id || event.data.message_id || event.data.email_id,
      metadata: {
        resend_email_id: event.data.email_id,
        attachments: email.attachments || [],
      },
    });

    return NextResponse.json({ received: true, ticketId: result.ticketId });
  } catch (error) {
    console.error('Inbound support email error:', error);
    return NextResponse.json({ error: 'Traitement temporairement indisponible' }, { status: 500 });
  }
}
