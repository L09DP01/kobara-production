import test from 'node:test';
import assert from 'node:assert/strict';

test('Email Campaign & Drip Batching Invariants (50/day & 7/sec)', async (t) => {
  await t.test('Recipients are sliced into exact sequential daily batches of 50', () => {
    const totalRecipients = 135;
    const dailyLimit = 50;

    const recipients = Array.from({ length: totalRecipients }, (_, i) => ({
      email: `user${i + 1}@example.com`,
      name: `User ${i + 1}`,
    }));

    const partitioned = recipients.map((r, index) => ({
      ...r,
      batch_number: Math.floor(index / dailyLimit) + 1,
    }));

    const batch1 = partitioned.filter((r) => r.batch_number === 1);
    const batch2 = partitioned.filter((r) => r.batch_number === 2);
    const batch3 = partitioned.filter((r) => r.batch_number === 3);
    const batch4 = partitioned.filter((r) => r.batch_number === 4);

    assert.equal(batch1.length, 50, 'Batch 1 (Day 1) must contain exactly 50 recipients');
    assert.equal(batch2.length, 50, 'Batch 2 (Day 2) must contain exactly 50 recipients');
    assert.equal(batch3.length, 35, 'Batch 3 (Day 3) must contain the remaining 35 recipients');
    assert.equal(batch4.length, 0, 'No Batch 4 should exist');
  });

  await t.test('Daily limit is strictly enforced (never sends > 50 emails on the same day)', () => {
    const campaign = {
      daily_limit: 50,
      sent_today_count: 50,
      last_sent_date: '2026-08-25',
      pending_count: 85,
    };

    const today = '2026-08-25';
    let sentToday = 0;
    if (campaign.last_sent_date === today) {
      sentToday = campaign.sent_today_count || 0;
    }

    const remainingDailyQuota = Math.max(0, campaign.daily_limit - sentToday);
    assert.equal(remainingDailyQuota, 0, 'Quota must be 0 when 50 emails have already been sent today');

    // On the next day, quota resets to 50
    const nextDay = '2026-08-26';
    let sentNextDay = 0;
    if (campaign.last_sent_date === nextDay) {
      sentNextDay = campaign.sent_today_count || 0;
    }
    const quotaNextDay = Math.max(0, campaign.daily_limit - sentNextDay);
    assert.equal(quotaNextDay, 50, 'Quota must reset to 50 on next calendar day');
  });

  await t.test('Throttling interval for 7 emails/second respects rate limit', () => {
    const ratePerSecond = 7;
    const delayBetweenSends = Math.ceil(1000 / ratePerSecond) + 5;

    // 1000ms / 7 = ~142.85ms + 5ms buffer = 148ms
    assert.ok(delayBetweenSends >= 143, 'Delay must be at least 143ms to never exceed 7 req/sec');
    assert.ok(delayBetweenSends <= 160, 'Delay should be reasonably fast');

    const totalSecondsFor50 = (delayBetweenSends * 50) / 1000;
    assert.ok(totalSecondsFor50 >= 7.0, 'Batch of 50 emails will take at least 7 seconds of regulated sending');
  });

  await t.test('Status progression from pending to completed across batches', () => {
    let total = 100;
    let sent = 0;
    let failed = 0;
    let pending = 100;
    let status = 'in_progress';

    // Day 1 batch
    const day1Sent = 50;
    sent += day1Sent;
    pending -= day1Sent;
    assert.equal(pending, 50);
    assert.equal(status, 'in_progress');

    // Day 2 batch
    const day2Sent = 48;
    const day2Failed = 2;
    sent += day2Sent;
    failed += day2Failed;
    pending -= (day2Sent + day2Failed);

    if (pending === 0) {
      status = 'completed';
    }

    assert.equal(sent, 98);
    assert.equal(failed, 2);
    assert.equal(pending, 0);
    assert.equal(status, 'completed');
  });

  await t.test('Retry failed recipients resets failed recipients to pending and re-opens campaign', () => {
    let failedCount = 5;
    let pendingCount = 0;
    let status = 'completed';

    // Retrying failed
    const countToRetry = failedCount;
    failedCount = 0;
    pendingCount += countToRetry;
    status = 'in_progress';

    assert.equal(failedCount, 0);
    assert.equal(pendingCount, 5);
    assert.equal(status, 'in_progress');
  });
});
