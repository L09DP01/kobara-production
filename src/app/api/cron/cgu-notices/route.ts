import { sendCguNoticeBatch } from '@/lib/server/cgu-publication';
import { getRuntimeEnvironmentValue } from '@/lib/server/runtime-env';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = getRuntimeEnvironmentValue('CRON_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return Response.json(await sendCguNoticeBatch());
  } catch {
    console.error('[CGU] Notice batch unavailable');
    return Response.json({ error: 'Notice batch unavailable' }, { status: 503 });
  }
}
