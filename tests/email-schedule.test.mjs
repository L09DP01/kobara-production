import test from 'node:test';
import assert from 'node:assert/strict';
import { runEmailSchedule } from '../workers/email-schedule.mjs';

const event = { cron: '17 * * * *' };
const env = { CRON_SECRET: 'test-only-placeholder' };
const logger = { info() {}, error() {} };

test('schedule dispatches both authenticated jobs with Worker bindings and context', async () => {
  const calls = [];
  const ctx = {};
  await runEmailSchedule(event, env, ctx, async (request, bindings, context) => {
    calls.push(new URL(request.url).pathname);
    assert.equal(request.headers.get('authorization'), `Bearer ${env.CRON_SECRET}`);
    assert.equal(request.method, 'GET');
    assert.equal(bindings, env);
    assert.equal(context, ctx);
    return new Response('{}');
  }, logger);
  assert.deepEqual(calls, ['/api/cron/merchant-activation', '/api/cron/smart-promotions']);
});

test('missing credentials and unexpected schedules fail before dispatch', async () => {
  const dispatch = () => assert.fail('Must not dispatch');
  for (const secret of [undefined, '', '  ']) {
    await assert.rejects(runEmailSchedule(event, { CRON_SECRET: secret }, {}, dispatch, logger), /CRON_SECRET/);
  }
  await assert.rejects(runEmailSchedule({ cron: '* * * * *' }, env, {}, dispatch, logger), /Unexpected/);
});

test('failure of one job does not skip the other or leak response details', async () => {
  const calls = [];
  const logs = [];
  const sink = { info: (line) => logs.push(line), error: (line) => logs.push(line) };
  await assert.rejects(runEmailSchedule(event, env, {}, async (request) => {
    calls.push(request.url);
    return new Response('private-recipient@example.invalid', { status: calls.length === 1 ? 500 : 200 });
  }, sink), /jobs failed/);
  assert.equal(calls.length, 2);
  assert.ok(logs.every((line) => !line.includes('private-recipient') && !line.includes(env.CRON_SECRET)));
});

test('dispatch exceptions are sanitized and mark the invocation failed', async () => {
  const logs = [];
  await assert.rejects(runEmailSchedule(event, env, {}, async () => {
    throw new Error(env.CRON_SECRET);
  }, { info() {}, error: (line) => logs.push(line) }), /jobs failed/);
  assert.equal(logs.length, 2);
  assert.ok(logs.every((line) => !line.includes(env.CRON_SECRET)));
});
