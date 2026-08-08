-- 0002_transactions_paid.sql

alter table transactions add column paid boolean not null default true;
