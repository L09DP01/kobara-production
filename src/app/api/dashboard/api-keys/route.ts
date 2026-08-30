import { NextResponse } from 'next/server';
import { generateApiKey, revokeApiKey } from '@/app/dashboard/api-keys/actions';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Veuillez entrer un nom pour la clé API.' }, { status: 400 });
    }

    const result = await generateApiKey(name, 'live');
    return NextResponse.json(result, { status: result.error ? 400 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne lors de la création de la clé.';
    console.error(JSON.stringify({ event: 'api_key_create_failed', message }));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Identifiant de clé manquant.' }, { status: 400 });
    }

    const result = await revokeApiKey(id);
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne lors de la révocation de la clé.';
    console.error(JSON.stringify({ event: 'api_key_revoke_failed', message }));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
