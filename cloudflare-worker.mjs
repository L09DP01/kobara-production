import handler from './.open-next/worker.js';
import { runEmailSchedule } from './workers/email-schedule.mjs';

export * from './.open-next/worker.js';

export default {
  ...handler,
  async scheduled(controller, env, ctx) {
    if (controller.cron === '* * * * *') {
      if (!env.CRON_SECRET?.trim()) throw new Error('Log monitor requires CRON_SECRET');
      const response = await handler.fetch(new Request('https://kobara.app/api/cron/log-monitor', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
        redirect: 'manual',
      }), env, ctx);
      await response.body?.cancel();
      if (!response.ok) throw new Error(`Log monitor failed: HTTP ${response.status}`);
      return;
    }
    await runEmailSchedule(controller, env, ctx, handler.fetch.bind(handler));
  },
};
