-- Migration to add test balances to merchants table

ALTER TABLE merchants
ADD COLUMN available_balance_test NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN pending_balance_test NUMERIC(10, 2) DEFAULT 0;

-- Set existing merchants to have 0 test balance
UPDATE merchants SET available_balance_test = 0, pending_balance_test = 0;
