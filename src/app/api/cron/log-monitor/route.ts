import { monitorLogs } from '@/lib/server/log-monitor';
import { getRuntimeEnvironmentValue } from '@/lib/server/runtime-env';

export async function POST(request: Request) {
  const secret = getRuntimeEnvironmentValue('CRON_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return Response.json(await monitorLogs());
  } catch {
    return Response.json({ error: 'Log monitor unavailable' }, { status: 503 });
  }
}
