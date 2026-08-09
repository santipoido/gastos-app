-- 0001_init.sql

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  color text,
  icon text,
  created_at timestamptz not null default now()
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  default_closing_day int not null check (default_closing_day between 1 and 31),
  default_due_day int not null check (default_due_day between 1 and 31),
  default_due_month_offset int not null default 1 check (default_due_month_offset in (0,1)),
  created_at timestamptz not null default now()
);

create table card_billing_config (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  year_month text not null,
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  due_month_offset int not null default 1 check (due_month_offset in (0,1)),
  unique (card_id, year_month)
);

create table recurring_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid not null references categories(id),
  amount_estimate numeric(12,2) not null,
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  paused_at timestamptz
);

create table recurring_skips (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references recurring_templates(id) on delete cascade,
  year_month text not null,
  unique (template_id, year_month)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  description text,
  category_id uuid not null references categories(id),
  payment_method text not null check (payment_method in ('cash','card')),
  card_id uuid references cards(id),
  installment_group_id uuid,
  installment_number int,
  installment_total int,
  recurring_template_id uuid references recurring_templates(id),
  source text not null check (source in ('manual','recurring','installment')),
  paid boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index transactions_recurring_month_unique
  on transactions (
    (extract(year from date)::int * 12 + extract(month from date)::int),
    recurring_template_id
  )
  where recurring_template_id is not null;

alter table categories enable row level security;
alter table cards enable row level security;
alter table card_billing_config enable row level security;
alter table recurring_templates enable row level security;
alter table recurring_skips enable row level security;
alter table transactions enable row level security;

create policy "categories_owner" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cards_owner" on cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions_owner" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recurring_templates_owner" on recurring_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "card_billing_config_owner" on card_billing_config
  for all using (
    exists (select 1 from cards where cards.id = card_billing_config.card_id and cards.user_id = auth.uid())
  ) with check (
    exists (select 1 from cards where cards.id = card_billing_config.card_id and cards.user_id = auth.uid())
  );

create policy "recurring_skips_owner" on recurring_skips
  for all using (
    exists (select 1 from recurring_templates t where t.id = recurring_skips.template_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from recurring_templates t where t.id = recurring_skips.template_id and t.user_id = auth.uid())
  );
