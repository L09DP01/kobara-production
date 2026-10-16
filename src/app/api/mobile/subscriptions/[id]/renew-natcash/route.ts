import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Les abonnements ne sont plus proposés.', code: 'SUBSCRIPTIONS_RETIRED' }, { status: 410 });
}
