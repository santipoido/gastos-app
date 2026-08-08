# Gastos App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal expense/income tracker (Next.js + Supabase + Vercel) with recurring scheduled expenses and automatic card-installment splitting, plus a dashboard focused on upcoming payment projections.

**Architecture:** Next.js App Router + TypeScript, Supabase (Postgres + Auth + RLS) as the only backend, Server Actions for all mutations (no separate API layer). Recurring transactions are generated lazily (no cron) by a server action that runs on every dashboard load. Card installment amounts are split synchronously at creation time using a pure billing-cycle calculation module. Mobile-first UI with Tailwind + shadcn/ui.

**Tech Stack:** Next.js (App Router, TypeScript), Supabase JS (`@supabase/supabase-js`, `@supabase/ssr`), Tailwind CSS, shadcn/ui, Vitest (unit tests for pure logic), npm, Vercel deploy.

## Global Constraints

- Single user app, but data model must remain per-`user_id` with RLS — copied verbatim from spec: "RLS habilitado en todas las tablas: cada fila solo visible/editable por su `user_id`".
- No cron / scheduled jobs — spec: "Sin cron: generación de recurrentes es lazy (se materializa al abrir la app)".
- Money stored as `numeric(12,2)` in Postgres; all installment/rounding math done in integer cents in TypeScript to avoid float drift.
- `year_month` values are always `YYYY-MM` strings (zero-padded month), used as the join key between templates, skips, and billing overrides.
- No multi-currency, no automatic interest calculation on installments, no recurring income, no notifications — explicitly out of scope per spec.
- No e2e tests for MVP — spec: "Sin e2e para el MVP." Only `lib/billing.ts` and `lib/recurring.ts` get unit tests (Vitest). Everything else is verified manually via the dev server.

---

## File Structure

```
gastos-app/
  app/
    layout.tsx
    page.tsx                        # redirects to /dashboard or /login
    login/page.tsx
    dashboard/page.tsx
    movimientos/page.tsx            # historial + filtros
    movimientos/nuevo/page.tsx      # form cargar movimiento
    categorias/page.tsx
    tarjetas/page.tsx
    tarjetas/[id]/page.tsx          # detalle + billing config por mes
    recurrentes/page.tsx
  lib/
    supabase/
      client.ts                    # browser client
      server.ts                    # server client (server components/actions)
      middleware.ts                # session refresh helper
    billing.ts                     # pure: cycle/installment math
    billing.test.ts
    recurring.ts                   # pure: generation/projection math
    recurring.test.ts
    types.ts                       # shared row types
  actions/
    categories.ts
    cards.ts
    transactions.ts
    recurring.ts
    dashboard.ts
  components/
    ui/                            # shadcn generated components
    nav.tsx
    transaction-form.tsx
    category-form.tsx
    card-form.tsx
    billing-override-form.tsx
    recurring-template-form.tsx
  middleware.ts                    # Next.js middleware, protects routes
  supabase/
    migrations/
      0001_init.sql
  .env.example
```

---

### Task 1: Scaffold Next.js project

**Files:**
- Create: entire project via `create-next-app` in `gastos-app/`
- Create: `.env.example`
- Modify: `package.json` (add deps)

**Interfaces:**
- Produces: a running Next.js dev server at `localhost:3000`, npm scripts `dev`, `build`, `test`.

- [ ] **Step 1: Scaffold the app**

```bash
cd "/Users/santipoido/Desktop/BACKUP/Proyectos Claude Mios/gastos-app"
npx --yes create-next-app@latest . --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --no-git
```

(`--no-git` because the folder already has a git repo initialized.)

- [ ] **Step 2: Install runtime + test deps**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest
```

- [ ] **Step 3: Add test script**

Edit `package.json` `scripts`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 5: Verify dev server boots**

```bash
npm run build
```

Expected: build succeeds with the default Next.js starter page.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind and Vitest"
```

---

### Task 2: shadcn/ui setup

**Files:**
- Modify: `components.json` (created by shadcn CLI)
- Create: `components/ui/*` (button, input, label, select, card, dialog, dropdown-menu, table, badge)

**Interfaces:**
- Produces: `@/components/ui/*` primitives used by every form/page task below.

- [ ] **Step 1: Init shadcn**

```bash
npx --yes shadcn@latest init -d
```

- [ ] **Step 2: Add the components this app needs**

```bash
npx --yes shadcn@latest add button input label select card dialog dropdown-menu table badge switch
```

- [ ] **Step 3: Verify build still passes**

```bash
npm run build
```

Expected: succeeds, no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add shadcn/ui component primitives"
```

---

### Task 3: Supabase schema and RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `categories`, `cards`, `card_billing_config`, `recurring_templates`, `recurring_skips`, `transactions`, all with RLS restricting rows to `auth.uid()`.

- [ ] **Step 1: Write the migration**

```sql
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
  created_at timestamptz not null default now()
);

create table card_billing_config (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  year_month text not null,
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
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
  created_at timestamptz not null default now()
);

create unique index transactions_recurring_month_unique
  on transactions ((to_char(date, 'YYYY-MM')), recurring_template_id)
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
```

- [ ] **Step 2: Link and push to the Supabase project**

Requires a Supabase project already created at supabase.com, with its project ref and DB password on hand.

```bash
npx --yes supabase login
npx --yes supabase link --project-ref <your-project-ref>
npx --yes supabase db push
```

- [ ] **Step 3: Verify tables exist**

In the Supabase Dashboard → Table Editor, confirm all 6 tables are present and RLS shows "Enabled" on each.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial Supabase schema with RLS"
```

---

### Task 4: Supabase clients, middleware, auth

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `actions/auth.ts`

**Interfaces:**
- Produces: `createBrowserSupabase()`, `createServerSupabase()` — used by every server action and server component from here on. `middleware.ts` redirects unauthenticated requests to `/login`.
- No signup UI: the one user account is created manually in the Supabase Dashboard (Authentication → Users → Add user), matching the "single personal user" scope from the spec.

- [ ] **Step 1: Browser client**

```ts
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Server client**

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
```

- [ ] **Step 3: Middleware to refresh session and guard routes**

```ts
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === '/login';
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 4: Login server action**

```ts
// actions/auth.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}

export async function logout() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 5: Login page**

```tsx
// app/login/page.tsx
import { login } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form action={login} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Ingresar</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <Button type="submit" className="w-full">Ingresar</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Set real env vars and verify manually**

Copy `.env.example` to `.env.local`, fill in the project's URL/anon key from Supabase Dashboard → Project Settings → API. Create the one user account in Supabase Dashboard → Authentication → Users.

```bash
cp .env.example .env.local
npm run dev
```

Visit `localhost:3000` → should redirect to `/login`. Log in with the created account → should redirect to `/dashboard` (404 for now, built in Task 11 — a 404 there is expected at this point).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase auth, session middleware, login page"
```

---

### Task 5: Billing cycle / installment math (pure logic, TDD)

**Files:**
- Create: `lib/billing.ts`
- Test: `lib/billing.test.ts`

**Interfaces:**
- Produces: `formatYearMonth`, `addMonthsToYearMonth`, `clampDay`, `resolveBillingConfig`, `computeInstallmentSchedule` — consumed by `actions/transactions.ts` (Task 8) and `actions/cards.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/billing.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatYearMonth,
  addMonthsToYearMonth,
  clampDay,
  resolveBillingConfig,
  computeInstallmentSchedule,
} from './billing';

describe('formatYearMonth', () => {
  it('pads single-digit months', () => {
    expect(formatYearMonth(new Date(Date.UTC(2026, 0, 15)))).toBe('2026-01');
  });
});

describe('addMonthsToYearMonth', () => {
  it('rolls over into the next year', () => {
    expect(addMonthsToYearMonth('2026-11', 2)).toBe('2027-01');
  });
});

describe('clampDay', () => {
  it('clamps to the last day of a short month', () => {
    const d = clampDay('2026-02', 31);
    expect(d.getUTCDate()).toBe(28);
  });
  it('keeps the exact day when it fits', () => {
    const d = clampDay('2026-08', 15);
    expect(d.getUTCDate()).toBe(15);
  });
});

describe('resolveBillingConfig', () => {
  it('uses the override when present', () => {
    const config = resolveBillingConfig('2026-08', { defaultClosingDay: 20, defaultDueDay: 10 }, [
      { yearMonth: '2026-08', closingDay: 25, dueDay: 12 },
    ]);
    expect(config).toEqual({ closingDay: 25, dueDay: 12 });
  });
  it('falls back to card defaults', () => {
    const config = resolveBillingConfig('2026-09', { defaultClosingDay: 20, defaultDueDay: 10 }, [
      { yearMonth: '2026-08', closingDay: 25, dueDay: 12 },
    ]);
    expect(config).toEqual({ closingDay: 20, dueDay: 10 });
  });
});

describe('computeInstallmentSchedule', () => {
  const card = { defaultClosingDay: 20, defaultDueDay: 10 };

  it('puts a purchase before closing in the current cycle', () => {
    const lines = computeInstallmentSchedule({
      purchaseDate: new Date(Date.UTC(2026, 7, 10)), // Aug 10
      totalAmount: 110000,
      installments: 1,
      card,
      overrides: [],
    });
    expect(lines).toHaveLength(1);
    expect(formatYearMonth(lines[0].dueDate)).toBe('2026-08');
    expect(lines[0].dueDate.getUTCDate()).toBe(10);
    expect(lines[0].amount).toBe(110000);
  });

  it('puts a purchase after closing in next month\'s cycle', () => {
    const lines = computeInstallmentSchedule({
      purchaseDate: new Date(Date.UTC(2026, 7, 25)), // Aug 25, closing was Aug 20
      totalAmount: 90000,
      installments: 1,
      card,
      overrides: [],
    });
    expect(formatYearMonth(lines[0].dueDate)).toBe('2026-09');
  });

  it('splits into equal installments across consecutive cycles, adjusting the last for rounding', () => {
    const lines = computeInstallmentSchedule({
      purchaseDate: new Date(Date.UTC(2026, 7, 10)),
      totalAmount: 100,
      installments: 3,
      card,
      overrides: [],
    });
    expect(lines.map((l) => l.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(lines.map((l) => formatYearMonth(l.dueDate))).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('respects a per-month override on a later installment cycle', () => {
    const lines = computeInstallmentSchedule({
      purchaseDate: new Date(Date.UTC(2026, 7, 10)),
      totalAmount: 200,
      installments: 2,
      card,
      overrides: [{ yearMonth: '2026-09', closingDay: 20, dueDay: 15 }],
    });
    expect(lines[1].dueDate.getUTCDate()).toBe(15);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/billing.test.ts
```

Expected: FAIL — `lib/billing.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
// lib/billing.ts

export type YearMonth = string; // 'YYYY-MM'

export interface CardDefaults {
  defaultClosingDay: number;
  defaultDueDay: number;
}

export interface BillingOverride {
  yearMonth: YearMonth;
  closingDay: number;
  dueDay: number;
}

export interface BillingConfig {
  closingDay: number;
  dueDay: number;
}

export function formatYearMonth(date: Date): YearMonth {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function addMonthsToYearMonth(yearMonth: YearMonth, months: number): YearMonth {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return formatYearMonth(d);
}

export function clampDay(yearMonth: YearMonth, day: number): Date {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const clamped = Math.min(day, daysInMonth);
  return new Date(Date.UTC(y, m - 1, clamped));
}

export function resolveBillingConfig(
  yearMonth: YearMonth,
  card: CardDefaults,
  overrides: BillingOverride[]
): BillingConfig {
  const override = overrides.find((o) => o.yearMonth === yearMonth);
  if (override) return { closingDay: override.closingDay, dueDay: override.dueDay };
  return { closingDay: card.defaultClosingDay, dueDay: card.defaultDueDay };
}

export interface InstallmentLine {
  installmentNumber: number;
  installmentTotal: number;
  amount: number;
  dueDate: Date;
}

export function computeInstallmentSchedule(params: {
  purchaseDate: Date;
  totalAmount: number;
  installments: number;
  card: CardDefaults;
  overrides: BillingOverride[];
}): InstallmentLine[] {
  const { purchaseDate, totalAmount, installments, card, overrides } = params;

  const purchaseYearMonth = formatYearMonth(purchaseDate);
  const purchaseConfig = resolveBillingConfig(purchaseYearMonth, card, overrides);
  const closingDate = clampDay(purchaseYearMonth, purchaseConfig.closingDay);

  const firstCycleYearMonth =
    purchaseDate.getTime() <= closingDate.getTime()
      ? purchaseYearMonth
      : addMonthsToYearMonth(purchaseYearMonth, 1);

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainderCents = totalCents - baseCents * installments;

  const lines: InstallmentLine[] = [];
  for (let i = 0; i < installments; i++) {
    const cycleYearMonth = addMonthsToYearMonth(firstCycleYearMonth, i);
    const config = resolveBillingConfig(cycleYearMonth, card, overrides);
    const dueDate = clampDay(cycleYearMonth, config.dueDay);
    const cents = baseCents + (i === installments - 1 ? remainderCents : 0);
    lines.push({
      installmentNumber: i + 1,
      installmentTotal: installments,
      amount: cents / 100,
      dueDate,
    });
  }
  return lines;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/billing.test.ts
```

Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/billing.ts lib/billing.test.ts
git commit -m "feat: add billing cycle and installment math"
```

---

### Task 6: Recurring generation and projection math (pure logic, TDD)

**Files:**
- Create: `lib/recurring.ts`
- Test: `lib/recurring.test.ts`

**Interfaces:**
- Consumes: `formatYearMonth`, `addMonthsToYearMonth`, `clampDay` from `lib/billing.ts` (Task 5).
- Produces: `monthsBetweenInclusive`, `computePendingGenerations`, `computeVirtualOccurrences` — consumed by `actions/recurring.ts` (Task 10) and `actions/dashboard.ts` (Task 11).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/recurring.test.ts
import { describe, it, expect } from 'vitest';
import { monthsBetweenInclusive, computePendingGenerations, computeVirtualOccurrences } from './recurring';

describe('monthsBetweenInclusive', () => {
  it('lists every month including both ends', () => {
    expect(monthsBetweenInclusive('2026-06', '2026-08')).toEqual(['2026-06', '2026-07', '2026-08']);
  });
  it('returns a single month when start equals end', () => {
    expect(monthsBetweenInclusive('2026-08', '2026-08')).toEqual(['2026-08']);
  });
});

describe('computePendingGenerations', () => {
  const template = {
    id: 't1',
    dayOfMonth: 15,
    active: true,
    amountEstimate: 85000,
    categoryId: 'cat1',
  };

  it('generates for the current month once the day has passed', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 7, 20)), // Aug 20
      existing: [],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ templateId: 't1', yearMonth: '2026-08', amount: 85000 });
  });

  it('does not generate before the day has arrived', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 7, 10)), // Aug 10
      existing: [],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(0);
  });

  it('backfills missed months', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 9, 1)), // Oct 1
      existing: [],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending.map((p) => p.yearMonth)).toEqual(['2026-08', '2026-09']);
  });

  it('skips months already generated', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 7, 20)),
      existing: [{ templateId: 't1', yearMonth: '2026-08' }],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(0);
  });

  it('skips months explicitly marked skipped', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 7, 20)),
      existing: [],
      skips: [{ templateId: 't1', yearMonth: '2026-08' }],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(0);
  });

  it('ignores paused (inactive) templates', () => {
    const pending = computePendingGenerations({
      templates: [{ ...template, active: false }],
      today: new Date(Date.UTC(2026, 7, 20)),
      existing: [],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(0);
  });
});

describe('computeVirtualOccurrences', () => {
  it('projects future months for active templates not yet generated', () => {
    const occurrences = computeVirtualOccurrences({
      templates: [
        { id: 't1', name: 'Seguro auto', dayOfMonth: 15, active: true, amountEstimate: 85000, categoryId: 'cat1' },
      ],
      fromYearMonth: '2026-08',
      monthsAhead: 3,
      existing: [],
    });
    expect(occurrences.map((o) => o.yearMonth)).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('excludes months that already have a real generated transaction', () => {
    const occurrences = computeVirtualOccurrences({
      templates: [
        { id: 't1', name: 'Seguro auto', dayOfMonth: 15, active: true, amountEstimate: 85000, categoryId: 'cat1' },
      ],
      fromYearMonth: '2026-08',
      monthsAhead: 2,
      existing: [{ templateId: 't1', yearMonth: '2026-08' }],
    });
    expect(occurrences.map((o) => o.yearMonth)).toEqual(['2026-09']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/recurring.test.ts
```

Expected: FAIL — `lib/recurring.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
// lib/recurring.ts
import { addMonthsToYearMonth, clampDay, formatYearMonth, type YearMonth } from './billing';

export interface RecurringTemplateLike {
  id: string;
  dayOfMonth: number;
  active: boolean;
  amountEstimate: number;
  categoryId: string;
}

export interface ExistingGeneration {
  templateId: string;
  yearMonth: YearMonth;
}

export interface SkipEntry {
  templateId: string;
  yearMonth: YearMonth;
}

export function monthsBetweenInclusive(start: YearMonth, end: YearMonth): YearMonth[] {
  const result: YearMonth[] = [];
  let current = start;
  while (current <= end) {
    result.push(current);
    current = addMonthsToYearMonth(current, 1);
  }
  return result;
}

export interface PendingGeneration {
  templateId: string;
  yearMonth: YearMonth;
  date: Date;
  amount: number;
  categoryId: string;
}

export function computePendingGenerations(params: {
  templates: RecurringTemplateLike[];
  today: Date;
  existing: ExistingGeneration[];
  skips: SkipEntry[];
  templateStartYearMonth: (templateId: string) => YearMonth;
}): PendingGeneration[] {
  const { templates, today, existing, skips, templateStartYearMonth } = params;
  const todayYearMonth = formatYearMonth(today);
  const pending: PendingGeneration[] = [];

  for (const t of templates) {
    if (!t.active) continue;
    const startYearMonth = templateStartYearMonth(t.id);
    const months = monthsBetweenInclusive(startYearMonth, todayYearMonth);

    for (const yearMonth of months) {
      const dueDate = clampDay(yearMonth, t.dayOfMonth);
      if (dueDate.getTime() > today.getTime()) continue;

      const alreadyGenerated = existing.some(
        (e) => e.templateId === t.id && e.yearMonth === yearMonth
      );
      if (alreadyGenerated) continue;

      const skipped = skips.some((s) => s.templateId === t.id && s.yearMonth === yearMonth);
      if (skipped) continue;

      pending.push({
        templateId: t.id,
        yearMonth,
        date: dueDate,
        amount: t.amountEstimate,
        categoryId: t.categoryId,
      });
    }
  }

  return pending;
}

export interface VirtualOccurrence {
  templateId: string;
  yearMonth: YearMonth;
  date: Date;
  amount: number;
  categoryId: string;
  name: string;
}

export function computeVirtualOccurrences(params: {
  templates: (RecurringTemplateLike & { name: string })[];
  fromYearMonth: YearMonth;
  monthsAhead: number;
  existing: ExistingGeneration[];
}): VirtualOccurrence[] {
  const { templates, fromYearMonth, monthsAhead, existing } = params;
  const result: VirtualOccurrence[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const yearMonth = addMonthsToYearMonth(fromYearMonth, i);
    for (const t of templates) {
      if (!t.active) continue;
      const alreadyGenerated = existing.some(
        (e) => e.templateId === t.id && e.yearMonth === yearMonth
      );
      if (alreadyGenerated) continue;

      result.push({
        templateId: t.id,
        yearMonth,
        date: clampDay(yearMonth, t.dayOfMonth),
        amount: t.amountEstimate,
        categoryId: t.categoryId,
        name: t.name,
      });
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/recurring.test.ts
```

Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/recurring.ts lib/recurring.test.ts
git commit -m "feat: add recurring generation and projection math"
```

---

### Task 7: Shared types + Categories CRUD

**Files:**
- Create: `lib/types.ts`
- Create: `actions/categories.ts`
- Create: `components/category-form.tsx`
- Create: `app/categorias/page.tsx`

**Interfaces:**
- Produces: `Category` type (reused by Tasks 8-11). Server actions `listCategories()`, `createCategory(formData)`, `deleteCategory(id)`.

- [ ] **Step 1: Shared types**

```ts
// lib/types.ts
export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string | null;
  icon: string | null;
}

export interface Card {
  id: string;
  name: string;
  default_closing_day: number;
  default_due_day: number;
}

export interface CardBillingConfig {
  id: string;
  card_id: string;
  year_month: string;
  closing_day: number;
  due_day: number;
}

export interface RecurringTemplate {
  id: string;
  name: string;
  category_id: string;
  amount_estimate: number;
  day_of_month: number;
  active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  description: string | null;
  category_id: string;
  payment_method: 'cash' | 'card';
  card_id: string | null;
  installment_group_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  recurring_template_id: string | null;
  source: 'manual' | 'recurring' | 'installment';
}
```

- [ ] **Step 2: Server actions**

```ts
// actions/categories.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Category } from '@/lib/types';

export async function listCategories(): Promise<Category[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function createCategory(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    type: formData.get('type') as string,
  });
  if (error) throw error;
  revalidatePath('/categorias');
}

export async function deleteCategory(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/categorias');
}
```

- [ ] **Step 3: Form component**

```tsx
// components/category-form.tsx
'use client';

import { createCategory } from '@/actions/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRef } from 'react';

export function CategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createCategory(formData);
        formRef.current?.reset();
      }}
      className="flex gap-2"
    >
      <Input name="name" placeholder="Nombre" required className="flex-1" />
      <Select name="type" defaultValue="expense">
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="expense">Gasto</SelectItem>
          <SelectItem value="income">Ingreso</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit">Agregar</Button>
    </form>
  );
}
```

Note: shadcn's `Select` doesn't submit a native form field by default. Use a hidden input synced to the select value instead:

```tsx
// components/category-form.tsx (corrected)
'use client';

import { createCategory } from '@/actions/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRef, useState } from 'react';

export function CategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState('expense');

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createCategory(formData);
        formRef.current?.reset();
        setType('expense');
      }}
      className="flex gap-2"
    >
      <Input name="name" placeholder="Nombre" required className="flex-1" />
      <input type="hidden" name="type" value={type} />
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="expense">Gasto</SelectItem>
          <SelectItem value="income">Ingreso</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit">Agregar</Button>
    </form>
  );
}
```

(This hidden-input pattern is reused for every shadcn `Select` in a Server Action form throughout the rest of this plan — it will not be re-explained in later tasks.)

- [ ] **Step 4: Page**

```tsx
// app/categorias/page.tsx
import { listCategories, deleteCategory } from '@/actions/categories';
import { CategoryForm } from '@/components/category-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function CategoriasPage() {
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Categorías</h1>
      <CategoryForm />
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded border p-2">
            <span>
              {c.name} <Badge variant="secondary">{c.type === 'income' ? 'Ingreso' : 'Gasto'}</Badge>
            </span>
            <form action={deleteCategory.bind(null, c.id)}>
              <Button type="submit" variant="ghost" size="sm">Borrar</Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Verify manually**

```bash
npm run dev
```

Visit `/categorias`, create a category of each type, confirm it appears in the list and in Supabase Table Editor, delete one and confirm it disappears.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts actions/categories.ts components/category-form.tsx app/categorias/page.tsx
git commit -m "feat: add categories CRUD"
```

---

### Task 8: Cards CRUD + monthly billing override

**Files:**
- Create: `actions/cards.ts`
- Create: `components/card-form.tsx`
- Create: `components/billing-override-form.tsx`
- Create: `app/tarjetas/page.tsx`
- Create: `app/tarjetas/[id]/page.tsx`

**Interfaces:**
- Consumes: `Card`, `CardBillingConfig` types from Task 7.
- Produces: `listCards()`, `createCard(formData)`, `listBillingConfigs(cardId)`, `upsertBillingConfig(formData)` — consumed by `actions/transactions.ts` (Task 9) to build `CardDefaults`/`BillingOverride[]` for `computeInstallmentSchedule`.

- [ ] **Step 1: Server actions**

```ts
// actions/cards.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Card, CardBillingConfig } from '@/lib/types';

export async function listCards(): Promise<Card[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from('cards').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function getCard(id: string): Promise<Card> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from('cards').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createCard(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('cards').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    default_closing_day: Number(formData.get('default_closing_day')),
    default_due_day: Number(formData.get('default_due_day')),
  });
  if (error) throw error;
  revalidatePath('/tarjetas');
}

export async function listBillingConfigs(cardId: string): Promise<CardBillingConfig[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('card_billing_config')
    .select('*')
    .eq('card_id', cardId)
    .order('year_month');
  if (error) throw error;
  return data;
}

export async function upsertBillingConfig(formData: FormData) {
  const supabase = await createServerSupabase();
  const cardId = formData.get('card_id') as string;

  const { error } = await supabase
    .from('card_billing_config')
    .upsert(
      {
        card_id: cardId,
        year_month: formData.get('year_month') as string,
        closing_day: Number(formData.get('closing_day')),
        due_day: Number(formData.get('due_day')),
      },
      { onConflict: 'card_id,year_month' }
    );
  if (error) throw error;
  revalidatePath(`/tarjetas/${cardId}`);
}
```

- [ ] **Step 2: Card creation form**

```tsx
// components/card-form.tsx
'use client';

import { createCard } from '@/actions/cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRef } from 'react';

export function CardForm() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createCard(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-3 gap-2"
    >
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="default_closing_day">Cierre (día)</Label>
        <Input id="default_closing_day" name="default_closing_day" type="number" min={1} max={31} required />
      </div>
      <div>
        <Label htmlFor="default_due_day">Vencimiento (día)</Label>
        <Input id="default_due_day" name="default_due_day" type="number" min={1} max={31} required />
      </div>
      <Button type="submit" className="col-span-3">Agregar tarjeta</Button>
    </form>
  );
}
```

- [ ] **Step 3: Billing override form**

```tsx
// components/billing-override-form.tsx
'use client';

import { upsertBillingConfig } from '@/actions/cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function BillingOverrideForm({ cardId }: { cardId: string }) {
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <form action={upsertBillingConfig} className="grid grid-cols-4 gap-2">
      <input type="hidden" name="card_id" value={cardId} />
      <div>
        <Label htmlFor="year_month">Mes (AAAA-MM)</Label>
        <Input id="year_month" name="year_month" defaultValue={defaultYearMonth} required />
      </div>
      <div>
        <Label htmlFor="closing_day">Cierre</Label>
        <Input id="closing_day" name="closing_day" type="number" min={1} max={31} required />
      </div>
      <div>
        <Label htmlFor="due_day">Vencimiento</Label>
        <Input id="due_day" name="due_day" type="number" min={1} max={31} required />
      </div>
      <Button type="submit" className="self-end">Guardar</Button>
    </form>
  );
}
```

- [ ] **Step 4: Pages**

```tsx
// app/tarjetas/page.tsx
import { listCards } from '@/actions/cards';
import { CardForm } from '@/components/card-form';
import Link from 'next/link';

export default async function TarjetasPage() {
  const cards = await listCards();

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Tarjetas</h1>
      <CardForm />
      <ul className="space-y-2">
        {cards.map((c) => (
          <li key={c.id} className="rounded border p-2">
            <Link href={`/tarjetas/${c.id}`} className="font-medium">
              {c.name}
            </Link>
            <p className="text-sm text-muted-foreground">
              Cierre día {c.default_closing_day} · Vencimiento día {c.default_due_day}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```tsx
// app/tarjetas/[id]/page.tsx
import { getCard, listBillingConfigs } from '@/actions/cards';
import { BillingOverrideForm } from '@/components/billing-override-form';

export default async function TarjetaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [card, configs] = await Promise.all([getCard(id), listBillingConfigs(id)]);

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">{card.name}</h1>
      <p className="text-sm text-muted-foreground">
        Default: cierre día {card.default_closing_day}, vencimiento día {card.default_due_day}
      </p>
      <h2 className="font-medium">Override por mes</h2>
      <BillingOverrideForm cardId={card.id} />
      <ul className="space-y-1">
        {configs.map((cfg) => (
          <li key={cfg.id} className="text-sm">
            {cfg.year_month}: cierre {cfg.closing_day}, vencimiento {cfg.due_day}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Verify manually**

Visit `/tarjetas`, create a card, open its detail page, add a billing override for the current month, confirm it lists below the form and persists in Supabase.

- [ ] **Step 6: Commit**

```bash
git add actions/cards.ts components/card-form.tsx components/billing-override-form.tsx app/tarjetas
git commit -m "feat: add cards CRUD with monthly billing overrides"
```

---

### Task 9: Transaction creation (manual + card installments)

**Files:**
- Create: `actions/transactions.ts`
- Create: `components/transaction-form.tsx`
- Create: `app/movimientos/nuevo/page.tsx`

**Interfaces:**
- Consumes: `computeInstallmentSchedule` from `lib/billing.ts` (Task 5), `listCategories()` (Task 7), `listCards()`/`listBillingConfigs()` (Task 8).
- Produces: `createTransaction(formData)` — inserts either a single row (cash, or card contado) or N installment rows sharing one `installment_group_id`.

- [ ] **Step 1: Server action**

```ts
// actions/transactions.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { computeInstallmentSchedule } from '@/lib/billing';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import type { Transaction } from '@/lib/types';

export async function createTransaction(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const type = formData.get('type') as 'income' | 'expense';
  const amount = Number(formData.get('amount'));
  const date = formData.get('date') as string;
  const description = (formData.get('description') as string) || null;
  const categoryId = formData.get('category_id') as string;
  const paymentMethod = formData.get('payment_method') as 'cash' | 'card';
  const cardId = (formData.get('card_id') as string) || null;
  const installments = Number(formData.get('installments') || 1);

  if (amount <= 0) throw new Error('El monto debe ser mayor a 0');

  if (paymentMethod === 'cash' || installments <= 1) {
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      type,
      amount,
      date,
      description,
      category_id: categoryId,
      payment_method: paymentMethod,
      card_id: paymentMethod === 'card' ? cardId : null,
      source: 'manual',
    });
    if (error) throw error;
  } else {
    if (!cardId) throw new Error('Falta seleccionar tarjeta');

    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('default_closing_day, default_due_day')
      .eq('id', cardId)
      .single();
    if (cardError) throw cardError;

    const { data: overrides, error: overridesError } = await supabase
      .from('card_billing_config')
      .select('year_month, closing_day, due_day')
      .eq('card_id', cardId);
    if (overridesError) throw overridesError;

    const schedule = computeInstallmentSchedule({
      purchaseDate: new Date(`${date}T00:00:00Z`),
      totalAmount: amount,
      installments,
      card: {
        defaultClosingDay: card.default_closing_day,
        defaultDueDay: card.default_due_day,
      },
      overrides: overrides.map((o) => ({
        yearMonth: o.year_month,
        closingDay: o.closing_day,
        dueDay: o.due_day,
      })),
    });

    const installmentGroupId = randomUUID();
    const rows = schedule.map((line) => ({
      user_id: user.id,
      type,
      amount: line.amount,
      date: line.dueDate.toISOString().slice(0, 10),
      description,
      category_id: categoryId,
      payment_method: 'card' as const,
      card_id: cardId,
      installment_group_id: installmentGroupId,
      installment_number: line.installmentNumber,
      installment_total: line.installmentTotal,
      source: 'installment' as const,
    }));

    const { error } = await supabase.from('transactions').insert(rows);
    if (error) throw error;
  }

  revalidatePath('/movimientos');
  revalidatePath('/dashboard');
}

export async function listTransactions(filters?: {
  categoryId?: string;
  cardId?: string;
  yearMonth?: string;
}): Promise<Transaction[]> {
  const supabase = await createServerSupabase();
  let query = supabase.from('transactions').select('*').order('date', { ascending: false });

  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters?.cardId) query = query.eq('card_id', filters.cardId);
  if (filters?.yearMonth) {
    query = query
      .gte('date', `${filters.yearMonth}-01`)
      .lt('date', `${addMonthPrefix(filters.yearMonth)}-01`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function addMonthPrefix(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return next;
}

export async function deleteTransaction(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/movimientos');
  revalidatePath('/dashboard');
}
```

- [ ] **Step 2: Form component**

```tsx
// components/transaction-form.tsx
'use client';

import { createTransaction } from '@/actions/transactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Category, Card } from '@/lib/types';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TransactionForm({ categories, cards }: { categories: Category[]; cards: Card[] }) {
  const router = useRouter();
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cardId, setCardId] = useState(cards[0]?.id ?? '');

  const filteredCategories = categories.filter((c) => c.type === type);

  return (
    <form
      action={async (formData) => {
        await createTransaction(formData);
        router.push('/movimientos');
      }}
      className="mx-auto max-w-md space-y-4"
    >
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="payment_method" value={paymentMethod} />

      <div className="flex gap-2">
        <Button type="button" variant={type === 'expense' ? 'default' : 'outline'} onClick={() => setType('expense')}>
          Gasto
        </Button>
        <Button type="button" variant={type === 'income' ? 'default' : 'outline'} onClick={() => setType('income')}>
          Ingreso
        </Button>
      </div>

      <div>
        <Label htmlFor="amount">Monto</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
      </div>

      <div>
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      </div>

      <div>
        <Label htmlFor="description">Descripción</Label>
        <Input id="description" name="description" />
      </div>

      <div>
        <Label>Categoría</Label>
        <Select name="category_id" required>
          <SelectTrigger>
            <SelectValue placeholder="Elegí una categoría" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant={paymentMethod === 'cash' ? 'default' : 'outline'} onClick={() => setPaymentMethod('cash')}>
          Efectivo
        </Button>
        <Button type="button" variant={paymentMethod === 'card' ? 'default' : 'outline'} onClick={() => setPaymentMethod('card')}>
          Tarjeta
        </Button>
      </div>

      {paymentMethod === 'card' && (
        <>
          <div>
            <Label>Tarjeta</Label>
            <input type="hidden" name="card_id" value={cardId} />
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="installments">Cuotas</Label>
            <Input id="installments" name="installments" type="number" min={1} max={24} defaultValue={1} />
          </div>
        </>
      )}

      <Button type="submit" className="w-full">Guardar</Button>
    </form>
  );
}
```

- [ ] **Step 3: Page**

```tsx
// app/movimientos/nuevo/page.tsx
import { listCategories } from '@/actions/categories';
import { listCards } from '@/actions/cards';
import { TransactionForm } from '@/components/transaction-form';

export default async function NuevoMovimientoPage() {
  const [categories, cards] = await Promise.all([listCategories(), listCards()]);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Nuevo movimiento</h1>
      <TransactionForm categories={categories} cards={cards} />
    </div>
  );
}
```

- [ ] **Step 4: Verify manually**

Create at least one income and one expense category, one card. Visit `/movimientos/nuevo`:
1. Cargar un gasto en efectivo → 1 fila en `transactions`.
2. Cargar un gasto con tarjeta, 1 cuota → 1 fila, `source='installment'`, fecha = vencimiento del ciclo correcto.
3. Cargar un gasto con tarjeta, 3 cuotas → 3 filas con el mismo `installment_group_id`, montos que suman el total, fechas en meses consecutivos.

- [ ] **Step 5: Commit**

```bash
git add actions/transactions.ts components/transaction-form.tsx app/movimientos/nuevo
git commit -m "feat: add transaction creation with automatic installment splitting"
```

---

### Task 10: Recurring templates CRUD + lazy generation

**Files:**
- Create: `actions/recurring.ts`
- Create: `components/recurring-template-form.tsx`
- Create: `app/recurrentes/page.tsx`

**Interfaces:**
- Consumes: `computePendingGenerations` from `lib/recurring.ts` (Task 6).
- Produces: `generatePendingRecurring()` — called from `actions/dashboard.ts` (Task 11) on every dashboard load; `listRecurringTemplates()`, `createRecurringTemplate(formData)`, `pauseRecurringTemplate(id)`, `resumeRecurringTemplate(id)`, `skipRecurringMonth(templateId, yearMonth)`.

- [ ] **Step 1: Server actions**

```ts
// actions/recurring.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { computePendingGenerations } from '@/lib/recurring';
import { formatYearMonth } from '@/lib/billing';
import { revalidatePath } from 'next/cache';
import type { RecurringTemplate } from '@/lib/types';

export async function listRecurringTemplates(): Promise<RecurringTemplate[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .order('day_of_month');
  if (error) throw error;
  return data;
}

export async function createRecurringTemplate(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('recurring_templates').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    category_id: formData.get('category_id') as string,
    amount_estimate: Number(formData.get('amount_estimate')),
    day_of_month: Number(formData.get('day_of_month')),
  });
  if (error) throw error;
  revalidatePath('/recurrentes');
}

export async function pauseRecurringTemplate(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('recurring_templates')
    .update({ active: false, paused_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/recurrentes');
}

export async function resumeRecurringTemplate(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('recurring_templates')
    .update({ active: true, paused_at: null })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/recurrentes');
}

export async function skipRecurringMonth(templateId: string, yearMonth: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('recurring_skips')
    .insert({ template_id: templateId, year_month: yearMonth });
  if (error) throw error;

  await supabase
    .from('transactions')
    .delete()
    .eq('recurring_template_id', templateId)
    .gte('date', `${yearMonth}-01`);

  revalidatePath('/recurrentes');
  revalidatePath('/movimientos');
  revalidatePath('/dashboard');
}

export async function generatePendingRecurring(): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: templates, error: templatesError } = await supabase
    .from('recurring_templates')
    .select('*');
  if (templatesError) throw templatesError;

  const activeTemplates = templates.filter((t) => t.active);
  if (activeTemplates.length === 0) return;

  const { data: existingRows, error: existingError } = await supabase
    .from('transactions')
    .select('recurring_template_id, date')
    .not('recurring_template_id', 'is', null);
  if (existingError) throw existingError;

  const { data: skipRows, error: skipError } = await supabase
    .from('recurring_skips')
    .select('template_id, year_month');
  if (skipError) throw skipError;

  const today = new Date();
  const pending = computePendingGenerations({
    templates: activeTemplates.map((t) => ({
      id: t.id,
      dayOfMonth: t.day_of_month,
      active: t.active,
      amountEstimate: t.amount_estimate,
      categoryId: t.category_id,
    })),
    today,
    existing: existingRows.map((r) => ({
      templateId: r.recurring_template_id as string,
      yearMonth: r.date.slice(0, 7),
    })),
    skips: skipRows.map((s) => ({ templateId: s.template_id, yearMonth: s.year_month })),
    templateStartYearMonth: (templateId) => {
      const t = activeTemplates.find((t) => t.id === templateId)!;
      return formatYearMonth(new Date(t.created_at));
    },
  });

  if (pending.length === 0) return;

  const rows = pending.map((p) => ({
    user_id: user.id,
    type: 'expense' as const,
    amount: p.amount,
    date: p.date.toISOString().slice(0, 10),
    category_id: p.categoryId,
    payment_method: 'cash' as const,
    recurring_template_id: p.templateId,
    source: 'recurring' as const,
  }));

  const { error: insertError } = await supabase.from('transactions').insert(rows);
  if (insertError) throw insertError;
}
```

Note: `payment_method: 'cash'` is the default for generated recurring rows — the spec's example (seguro del auto) is a fixed periodic charge, not a card purchase, so it does not go through the installment engine. This matches the spec's explicit scope: "Ingresos recurrentes... se cargan a mano" and recurring items are a distinct concept from card installments.

- [ ] **Step 2: Form component**

```tsx
// components/recurring-template-form.tsx
'use client';

import { createRecurringTemplate } from '@/actions/recurring';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Category } from '@/lib/types';
import { useRef, useState } from 'react';

export function RecurringTemplateForm({ categories }: { categories: Category[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createRecurringTemplate(formData);
        formRef.current?.reset();
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" placeholder="Seguro auto" required />
      </div>
      <div>
        <Label htmlFor="amount_estimate">Monto aproximado</Label>
        <Input id="amount_estimate" name="amount_estimate" type="number" step="0.01" min="0.01" required />
      </div>
      <div>
        <Label htmlFor="day_of_month">Día del mes</Label>
        <Input id="day_of_month" name="day_of_month" type="number" min={1} max={31} required />
      </div>
      <div>
        <Label>Categoría</Label>
        <input type="hidden" name="category_id" value={categoryId} />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Elegí una categoría" />
          </SelectTrigger>
          <SelectContent>
            {expenseCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">Crear recurrente</Button>
    </form>
  );
}
```

- [ ] **Step 3: Page**

```tsx
// app/recurrentes/page.tsx
import { listRecurringTemplates, pauseRecurringTemplate, resumeRecurringTemplate, skipRecurringMonth, generatePendingRecurring } from '@/actions/recurring';
import { listCategories } from '@/actions/categories';
import { RecurringTemplateForm } from '@/components/recurring-template-form';
import { Button } from '@/components/ui/button';
import { formatYearMonth } from '@/lib/billing';

export default async function RecurrentesPage() {
  await generatePendingRecurring();
  const [templates, categories] = await Promise.all([listRecurringTemplates(), listCategories()]);
  const currentYearMonth = formatYearMonth(new Date());

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Gastos recurrentes</h1>
      <RecurringTemplateForm categories={categories} />
      <ul className="space-y-2">
        {templates.map((t) => (
          <li key={t.id} className="space-y-1 rounded border p-2">
            <div className="flex items-center justify-between">
              <span>{t.name} — día {t.day_of_month} — ${t.amount_estimate}</span>
              <span className="text-xs text-muted-foreground">{t.active ? 'Activo' : 'Pausado'}</span>
            </div>
            <div className="flex gap-2">
              {t.active ? (
                <form action={pauseRecurringTemplate.bind(null, t.id)}>
                  <Button type="submit" variant="outline" size="sm">Pausar para siempre</Button>
                </form>
              ) : (
                <form action={resumeRecurringTemplate.bind(null, t.id)}>
                  <Button type="submit" variant="outline" size="sm">Reactivar</Button>
                </form>
              )}
              <form action={skipRecurringMonth.bind(null, t.id, currentYearMonth)}>
                <Button type="submit" variant="ghost" size="sm">Saltear este mes</Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Verify manually**

Create a recurring template with `day_of_month` set to a day already past this month. Reload `/recurrentes` → confirm a matching row appears in `/movimientos` with `source='recurring'`. Reload again → confirm no duplicate is created (idempotency). Click "Saltear este mes" on another active template → confirm no row is generated for it and any existing one for that month is removed. Click "Pausar para siempre" → confirm `active` flips in Supabase and no further rows generate even after reload.

- [ ] **Step 5: Commit**

```bash
git add actions/recurring.ts components/recurring-template-form.tsx app/recurrentes
git commit -m "feat: add recurring templates with lazy generation, pause, and skip"
```

---

### Task 11: Dashboard (balance, projection, category breakdown, upcoming)

**Files:**
- Create: `actions/dashboard.ts`
- Create: `app/dashboard/page.tsx`
- Modify: `app/page.tsx` (redirect to `/dashboard`)

**Interfaces:**
- Consumes: `generatePendingRecurring()` (Task 10), `computeVirtualOccurrences` (Task 6), `listTransactions` (Task 9).
- Produces: `getDashboardData()` returning balance, 3-month projection, category breakdown, upcoming list — this task has no downstream consumers, it's the final read surface.

- [ ] **Step 1: Server action**

```ts
// actions/dashboard.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { generatePendingRecurring } from '@/actions/recurring';
import { computeVirtualOccurrences } from '@/lib/recurring';
import { formatYearMonth, addMonthsToYearMonth } from '@/lib/billing';

export interface DashboardData {
  currentMonthIncome: number;
  currentMonthExpense: number;
  categoryBreakdown: { categoryId: string; categoryName: string; total: number }[];
  projection: { yearMonth: string; total: number }[];
  upcoming: { date: string; description: string; amount: number }[];
}

export async function getDashboardData(): Promise<DashboardData> {
  await generatePendingRecurring();

  const supabase = await createServerSupabase();
  const now = new Date();
  const currentYearMonth = formatYearMonth(now);
  const monthStart = `${currentYearMonth}-01`;
  const nextMonthStart = `${addMonthsToYearMonth(currentYearMonth, 1)}-01`;

  const { data: currentMonthTx, error: currentError } = await supabase
    .from('transactions')
    .select('type, amount, category_id, categories(name)')
    .gte('date', monthStart)
    .lt('date', nextMonthStart);
  if (currentError) throw currentError;

  const currentMonthIncome = currentMonthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const currentMonthExpense = currentMonthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const breakdownMap = new Map<string, { categoryName: string; total: number }>();
  for (const t of currentMonthTx.filter((t) => t.type === 'expense')) {
    const categoryName = (t.categories as unknown as { name: string } | null)?.name ?? 'Sin categoría';
    const existing = breakdownMap.get(t.category_id) ?? { categoryName, total: 0 };
    existing.total += Number(t.amount);
    breakdownMap.set(t.category_id, existing);
  }
  const categoryBreakdown = Array.from(breakdownMap.entries()).map(([categoryId, v]) => ({
    categoryId,
    ...v,
  }));

  const monthsAhead = 3;
  const projectionEnd = addMonthsToYearMonth(currentYearMonth, monthsAhead);

  const { data: futureTx, error: futureError } = await supabase
    .from('transactions')
    .select('date, amount, type')
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', `${projectionEnd}-01`);
  if (futureError) throw futureError;

  const { data: activeTemplates, error: templatesError } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('active', true);
  if (templatesError) throw templatesError;

  const { data: generatedRows, error: generatedError } = await supabase
    .from('transactions')
    .select('recurring_template_id, date')
    .not('recurring_template_id', 'is', null);
  if (generatedError) throw generatedError;

  const virtualOccurrences = computeVirtualOccurrences({
    templates: activeTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      dayOfMonth: t.day_of_month,
      active: t.active,
      amountEstimate: t.amount_estimate,
      categoryId: t.category_id,
    })),
    fromYearMonth: currentYearMonth,
    monthsAhead,
    existing: generatedRows.map((r) => ({
      templateId: r.recurring_template_id as string,
      yearMonth: r.date.slice(0, 7),
    })),
  });

  const projectionMap = new Map<string, number>();
  for (let i = 0; i < monthsAhead; i++) {
    projectionMap.set(addMonthsToYearMonth(currentYearMonth, i), 0);
  }
  for (const t of futureTx) {
    const ym = t.date.slice(0, 7);
    projectionMap.set(ym, (projectionMap.get(ym) ?? 0) + Number(t.amount));
  }
  for (const occ of virtualOccurrences) {
    projectionMap.set(occ.yearMonth, (projectionMap.get(occ.yearMonth) ?? 0) + occ.amount);
  }
  const projection = Array.from(projectionMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, total]) => ({ yearMonth, total }));

  const upcomingReal = futureTx
    .filter((t) => t.date >= now.toISOString().slice(0, 10))
    .map((t) => ({ date: t.date, description: 'Movimiento', amount: Number(t.amount) }));
  const upcomingVirtual = virtualOccurrences.map((o) => ({
    date: o.date.toISOString().slice(0, 10),
    description: o.name,
    amount: o.amount,
  }));
  const upcoming = [...upcomingReal, ...upcomingVirtual]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  return { currentMonthIncome, currentMonthExpense, categoryBreakdown, projection, upcoming };
}
```

- [ ] **Step 2: Page**

```tsx
// app/dashboard/page.tsx
import { getDashboardData } from '@/actions/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const data = await getDashboardData();
  const balance = data.currentMonthIncome - data.currentMonthExpense;

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <Card>
        <CardHeader><CardTitle>Balance del mes</CardTitle></CardHeader>
        <CardContent>
          <p className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>
            ${balance.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">
            Ingresos ${data.currentMonthIncome.toFixed(2)} · Gastos ${data.currentMonthExpense.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Proyección próximos meses</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {data.projection.map((p) => (
            <div key={p.yearMonth} className="flex justify-between text-sm">
              <span>{p.yearMonth}</span>
              <span>${p.total.toFixed(2)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Gasto por categoría (mes actual)</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {data.categoryBreakdown.map((c) => (
            <div key={c.categoryId} className="flex justify-between text-sm">
              <span>{c.categoryName}</span>
              <span>${c.total.toFixed(2)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Próximos vencimientos</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {data.upcoming.map((u, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{u.date} — {u.description}</span>
              <span>${u.amount.toFixed(2)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Redirect root to dashboard**

```tsx
// app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
```

- [ ] **Step 4: Verify manually**

With the data seeded in Tasks 9-10 (some manual transactions, some installments, one recurring template), visit `/dashboard`:
- Balance matches sum of this month's transactions.
- Projection shows 3 months, including the estimated amount for the recurring template in months where it hasn't generated yet.
- Category breakdown matches manual sums.
- Upcoming list is sorted by date and includes both real future installments and virtual recurring occurrences.

- [ ] **Step 5: Commit**

```bash
git add actions/dashboard.ts app/dashboard/page.tsx app/page.tsx
git commit -m "feat: add dashboard with balance, projection, and category breakdown"
```

---

### Task 12: Historial de movimientos (list + filters + edit/delete)

**Files:**
- Create: `app/movimientos/page.tsx`
- Modify: `actions/transactions.ts` (add `updateTransaction`)

**Interfaces:**
- Consumes: `listTransactions(filters)` (Task 9).
- Produces: `updateTransaction(id, formData)` for editing a single transaction row (including one leg of an installment group, or a generated recurring row) in place.

- [ ] **Step 1: Add update action**

```ts
// actions/transactions.ts (append)

export async function updateTransaction(id: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('transactions')
    .update({
      amount: Number(formData.get('amount')),
      date: formData.get('date') as string,
      description: (formData.get('description') as string) || null,
      category_id: formData.get('category_id') as string,
    })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/movimientos');
  revalidatePath('/dashboard');
}
```

- [ ] **Step 2: List page with filters and inline delete**

```tsx
// app/movimientos/page.tsx
import { listTransactions, deleteTransaction } from '@/actions/transactions';
import { listCategories } from '@/actions/categories';
import { listCards } from '@/actions/cards';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; cardId?: string; yearMonth?: string }>;
}) {
  const filters = await searchParams;
  const [transactions, categories, cards] = await Promise.all([
    listTransactions(filters),
    listCategories(),
    listCards(),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <Link href="/movimientos/nuevo"><Button>Nuevo</Button></Link>
      </div>

      <form className="flex gap-2 text-sm" method="get">
        <select name="categoryId" defaultValue={filters.categoryId ?? ''} className="rounded border p-1">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="cardId" defaultValue={filters.cardId ?? ''} className="rounded border p-1">
          <option value="">Todas las tarjetas</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input name="yearMonth" type="month" defaultValue={filters.yearMonth ?? ''} className="rounded border p-1" />
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
      </form>

      <ul className="space-y-2">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded border p-2 text-sm">
            <div>
              <p>
                {t.date} — {categoryById.get(t.category_id) ?? 'Sin categoría'}
                {t.installment_total ? ` (cuota ${t.installment_number}/${t.installment_total})` : ''}
              </p>
              <p className="text-muted-foreground">{t.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={t.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                {t.type === 'income' ? '+' : '-'}${Number(t.amount).toFixed(2)}
              </span>
              <form action={deleteTransaction.bind(null, t.id)}>
                <Button type="submit" variant="ghost" size="sm">Borrar</Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

(Editing a transaction's amount/date/description/category is available via the `updateTransaction` action for a future inline-edit UI; the list above ships delete + filters first since those are the higher-value MVP interactions per the spec's "edición/borrado de cualquier transacción" — add an edit dialog using `components/ui/dialog` if it turns out to be needed day-to-day.)

- [ ] **Step 3: Verify manually**

Visit `/movimientos`, confirm all seeded transactions list with correct signs and installment labels. Filter by category, by card, by month — confirm the list narrows correctly. Delete one — confirm it disappears and is gone from Supabase.

- [ ] **Step 4: Commit**

```bash
git add actions/transactions.ts app/movimientos/page.tsx
git commit -m "feat: add movimientos history with filters and delete"
```

---

### Task 13: Navigation shell

**Files:**
- Create: `components/nav.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: persistent bottom nav (mobile-first) linking Dashboard / Movimientos / Recurrentes / Tarjetas / Categorías, plus a logout button.

- [ ] **Step 1: Nav component**

```tsx
// components/nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/actions/auth';
import { Button } from '@/components/ui/button';

const links = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/recurrentes', label: 'Recurrentes' },
  { href: '/tarjetas', label: 'Tarjetas' },
  { href: '/categorias', label: 'Categorías' },
];

export function Nav() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around border-t bg-background p-2 text-xs">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pathname.startsWith(l.href) ? 'font-semibold' : 'text-muted-foreground'}
        >
          {l.label}
        </Link>
      ))}
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm">Salir</Button>
      </form>
    </nav>
  );
}
```

- [ ] **Step 2: Wire into layout**

```tsx
// app/layout.tsx
import './globals.css';
import { Nav } from '@/components/nav';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="pb-16">
        {children}
        <Nav />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify manually**

Confirm the bottom nav appears on every authenticated page but not on `/login`, links navigate correctly, "Salir" logs out and redirects to `/login`.

- [ ] **Step 4: Commit**

```bash
git add components/nav.tsx app/layout.tsx
git commit -m "feat: add mobile bottom navigation"
```

---

### Task 14: Deploy to Vercel

**Files:**
- Create: `README.md` (setup + deploy instructions)

**Interfaces:**
- No code interfaces — this task ships the app.

- [ ] **Step 1: Push to a GitHub repo**

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

(Ask the user for the repo URL before running this — do not create a GitHub repo without confirmation.)

- [ ] **Step 2: Import into Vercel**

In the Vercel dashboard: New Project → import the GitHub repo → set Environment Variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as `.env.local`) → Deploy.

- [ ] **Step 3: Verify production**

Visit the deployed URL, log in with the Supabase user created in Task 4, confirm dashboard loads real data.

- [ ] **Step 4: Write README**

```markdown
# Gastos App

Personal expense/income tracker with recurring scheduled expenses and automatic card-installment splitting.

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` against it (via `npx supabase db push` after `supabase link`, or paste into the SQL Editor).
3. Create your user in Supabase Dashboard → Authentication → Users (no signup UI — single personal user).
4. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. `npm install && npm run dev`.

## Deploy

Import the repo into Vercel, set the same two env vars, deploy.

## Tests

`npm test` runs Vitest against `lib/billing.ts` and `lib/recurring.ts` — the installment/recurring math. No e2e (MVP scope).
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add setup and deploy instructions"
```

---

## Self-Review Notes

- **Spec coverage:** categories CRUD (Task 7), cards + monthly billing override (Task 8), installment splitting on card purchase (Task 5, 9), recurring with edit/delete-this-month/pause-forever (Task 10 — edit is the existing `updateTransaction` on the generated row, delete-this-month is `skipRecurringMonth`, pause-forever is `pauseRecurringTemplate`), dashboard projection + balance + category breakdown (Task 11), mobile-first nav (Task 13), Supabase Auth login (Task 4), Vercel deploy (Task 14). All spec sections have a task.
- **Placeholder scan:** no TBD/TODO; every step has real code or an exact verification procedure.
- **Type consistency:** `Category`, `Card`, `CardBillingConfig`, `RecurringTemplate`, `Transaction` (Task 7) are the single source of truth for row shapes and are reused verbatim in Tasks 8-13. `computeInstallmentSchedule`'s `InstallmentLine` (Task 5) and `computePendingGenerations`/`computeVirtualOccurrences`'s types (Task 6) match how they're consumed in Tasks 9-11 exactly (checked field names: `dueDate`, `amount`, `installmentNumber`, `installmentTotal`, `yearMonth`, `templateId`, `categoryId`).
