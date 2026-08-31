import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_MAINTENANCE_STATE,
  isMaintenanceBypassPath,
  isMaintenanceActive,
  maintenanceRetryAfter,
  normalizeMaintenanceState,
} from '../src/lib/maintenance-state.ts';

test('planned maintenance remains inactive before Sunday 17:00 Haiti time', () => {
  const state = normalizeMaintenanceState({
    ...DEFAULT_MAINTENANCE_STATE,
    auto_start: true,
    scheduled_for: '2026-08-30T21:00:00.000Z',
  });
  assert.equal(isMaintenanceActive(state, new Date('2026-08-30T20:59:59.000Z')), false);
});

test('planned maintenance activates exactly Sunday at 17:00 Haiti time', () => {
  const state = normalizeMaintenanceState({
    ...DEFAULT_MAINTENANCE_STATE,
    auto_start: true,
    scheduled_for: '2026-08-30T21:00:00.000Z',
  });
  assert.equal(isMaintenanceActive(state, new Date('2026-08-30T21:00:00.000Z')), true);
});

test('super-admin manual switch activates maintenance immediately', () => {
  const state = normalizeMaintenanceState({ ...DEFAULT_MAINTENANCE_STATE, enabled: true, auto_start: false });
  assert.equal(isMaintenanceActive(state, new Date('2026-08-29T10:00:00.000Z')), true);
});

test('reactivation disables a past automatic schedule', () => {
  const state = normalizeMaintenanceState({ ...DEFAULT_MAINTENANCE_STATE, enabled: false, auto_start: false });
  assert.equal(isMaintenanceActive(state, new Date('2026-09-01T10:00:00.000Z')), false);
});

test('maintenance API exposes a useful retry delay', () => {
  const state = normalizeMaintenanceState({
    ...DEFAULT_MAINTENANCE_STATE,
    scheduled_for: '2026-08-30T21:00:00.000Z',
  });
  assert.equal(maintenanceRetryAfter(state, new Date('2026-08-30T20:00:00.000Z')), 3600);
});

test('financial callbacks and System Core remain reachable for recovery', () => {
  assert.equal(isMaintenanceBypassPath('/api/webhooks/provider'), true);
  assert.equal(isMaintenanceBypassPath('/api/cron/reconcile-payments'), true);
  assert.equal(isMaintenanceBypassPath('/system-core/health'), true);
});

test('merchant services are suspended during maintenance', () => {
  assert.equal(isMaintenanceBypassPath('/api/v1/payments'), false);
  assert.equal(isMaintenanceBypassPath('/dashboard'), false);
  assert.equal(isMaintenanceBypassPath('/pay/example'), false);
});
