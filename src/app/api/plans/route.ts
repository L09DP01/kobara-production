import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ data: [], code: 'SUBSCRIPTIONS_RETIRED' }, { status: 410 });
}
