CREATE INDEX IF NOT EXISTS partner_withdrawals_reviewed_by_idx
  ON public.partner_withdrawals (reviewed_by)
  WHERE reviewed_by IS NOT NULL;
