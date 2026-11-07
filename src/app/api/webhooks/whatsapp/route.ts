export const dynamic = 'force-dynamic';

// Kapso owns inbound messages and human takeover. Never run a second local agent.
export async function GET() {
  return Response.json({ error: 'Legacy WhatsApp webhook retired. Configure support in Kapso.' }, { status: 410 });
}

export async function POST() {
  return Response.json({ error: 'Legacy WhatsApp webhook retired. Configure support in Kapso.' }, { status: 410 });
}
