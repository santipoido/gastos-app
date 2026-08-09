# Gastos App

Tracker personal de gastos e ingresos, con gastos recurrentes programados y cuotas de tarjeta que se dividen automáticamente entre meses.

## Setup

1. Crear un proyecto en [Supabase](https://supabase.com).
2. Correr `supabase/migrations/0001_init.sql` contra ese proyecto (pegándolo en el SQL Editor del dashboard, o con `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`).
3. Crear tu usuario en Supabase Dashboard → Authentication → Users (no hay UI de signup — la app es de un solo usuario personal).
4. Copiar `.env.example` a `.env.local` y completar `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API en el dashboard de Supabase).
5. `npm install && npm run dev`.

## Deploy

Importar el repo en Vercel, configurar las mismas dos variables de entorno, deploy.

## Tests

`npm test` corre Vitest sobre `lib/billing.ts` y `lib/recurring.ts` — la lógica de cuotas y generación recurrente. Sin e2e (fuera de alcance del MVP).

## Estructura

- `lib/billing.ts` — cálculo de ciclo de cierre/vencimiento de tarjeta y división en cuotas.
- `lib/recurring.ts` — generación lazy de gastos recurrentes y proyección de próximos meses.
- `actions/` — Server Actions (única capa de mutaciones, sin API REST separada).
- `app/` — páginas (dashboard, movimientos, recurrentes, tarjetas, categorías, login).
- `supabase/migrations/0001_init.sql` — schema completo + RLS.
- `supabase/migrations/0002_transactions_paid.sql` — columna `paid` para confirmar pagos de tarjeta/recurrentes.
- `supabase/migrations/0003_backfill_paid_pending.sql` — corrige a pendiente las cuotas/recurrentes ya cargadas con fecha hoy o futura.
