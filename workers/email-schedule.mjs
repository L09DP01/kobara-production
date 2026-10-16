const endpoints = [
  '/api/cron/merchant-activation',
  '/api/cron/smart-promotions',
];

export async function runEmailSchedule(controller, env, ctx, dispatch, logger = console) {
  if (controller.cron !== '17 * * * *') {
    throw new Error('Unexpected email schedule');
  }
  if (typeof env.CRON_SECRET !== 'string' || !env.CRON_SECRET.trim()) {
    throw new Error('Email schedule requires CRON_SECRET');
  }

  const results = await Promise.allSettled(endpoints.map(async (path) => {
    try {
      // Dispatch inside OpenNext so existing authentication, leases and consent checks apply.
      const response = await dispatch(new Request(`https://kobara.app${path}`, {
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
        redirect: 'error',
      }), env, ctx);
      await response.body?.cancel();
      logger.info(JSON.stringify({ event: 'email_schedule', path, status: response.status }));
      if (!response.ok) throw new Error('Unsuccessful scheduled endpoint');
    } catch {
      // Never log provider responses, credentials or recipient details.
      logger.error(JSON.stringify({ event: 'email_schedule_failed', path }));
      throw new Error(`Email schedule failed: ${path}`);
    }
  }));

  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('One or more email schedule jobs failed; inspect Worker logs');
  }
}
