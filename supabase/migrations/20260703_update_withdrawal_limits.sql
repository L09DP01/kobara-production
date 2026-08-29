-- Migration: Update daily withdrawal limits per plan
-- Pro: 10000 → 20000 HTG/day
-- Premium: 20000 → 50000 HTG/day

UPDATE plans SET daily_withdrawal_limit = 20000 WHERE slug = 'pro';
UPDATE plans SET daily_withdrawal_limit = 50000 WHERE slug = 'premium';
