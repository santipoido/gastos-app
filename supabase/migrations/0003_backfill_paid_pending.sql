-- 0003_backfill_paid_pending.sql
-- One-time correction: transactions.paid defaulted to true for all pre-existing
-- rows (0002), but card-installment and recurring rows dated today or later were
-- never actually confirmed paid — they just existed before this feature shipped.
-- Mark those pending; leave past-dated rows as paid so already-closed months'
-- historical totals don't shift.

update transactions
set paid = false
where source in ('installment', 'recurring')
  and date >= current_date;
