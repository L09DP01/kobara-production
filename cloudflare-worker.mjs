import handler from './.open-next/worker.js';
import { runEmailSchedule } from './workers/email-schedule.mjs';

export * from './.open-next/worker.js';

export default {
  ...handler,
  async scheduled(controller, env, ctx) {
    await runEmailSchedule(controller, env, ctx, handler.fetch.bind(handler));
  },
};
