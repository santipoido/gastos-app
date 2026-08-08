# Gastos App — Design Spec

Date: 2026-08-08
Status: Approved

## Purpose

App personal para registrar gastos e ingresos, con soporte para:
- Gastos/ingresos recurrentes con vencimiento fijo (ej: seguro del auto el 15 de cada mes, ~$85.000), editables/eliminables por mes puntual o pausables para siempre.
- Tarjetas de crédito con cierre y vencimiento configurable por mes, y compras en cuotas que se distribuyen automáticamente entre los meses correspondientes según el cierre.
- Métricas básicas, con foco principal en proyección de cuánto hay que pagar en los próximos meses.

Uso: personal, un solo usuario (con posibilidad de una 2da tarjeta), mobile-first.

## Stack

- Next.js (App Router) + TypeScript
- Supabase: Postgres + Auth (email/password) + Row Level Security
- Server Actions para todas las mutaciones (sin API REST separada)
- Tailwind + shadcn/ui
- Deploy: Vercel
- Sin cron: generación de recurrentes es lazy (se materializa al abrir la app)

## Modelo de datos

### `categories`
- id, user_id, name, type (`income` | `expense`), color, icon (opcional)

### `cards`
- id, user_id, name, default_closing_day (int 1-31), default_due_day (int 1-31)

### `card_billing_config`
- id, card_id, year_month (ej "2026-08"), closing_day, due_day
- Override puntual de un mes específico. Si no existe fila para el mes, se usa el default de `cards`.

### `recurring_templates`
- id, user_id, name, category_id, amount_estimate, day_of_month, active (bool), created_at, paused_at

### `recurring_skips`
- id, template_id, year_month
- Marca que ese mes puntual no debe generarse (sin pausar el template para siempre).

### `transactions`
- id, user_id, type (`income` | `expense`), amount, date, description, category_id
- payment_method (`cash` | `card`), card_id (nullable)
- installment_group_id (nullable), installment_number, installment_total
- recurring_template_id (nullable)
- source (`manual` | `recurring` | `installment`)

RLS habilitado en todas las tablas: cada fila solo visible/editable por su `user_id` (auth.uid()).

## Lógica clave

### Cuotas de tarjeta
Al cargar un gasto con tarjeta y N cuotas:
1. Se determina el ciclo de facturación de la compra según `card_billing_config` (o default de `cards`) del mes de la fecha de compra: si la compra es antes o igual al `closing_day`, cae en el ciclo del mes actual; si es posterior, cae en el ciclo del mes siguiente.
2. Se generan N filas en `transactions` de una sola vez, todas con el mismo `installment_group_id`, `installment_number` de 1 a N.
3. Monto de cada cuota = total / N, con la última cuota ajustando el redondeo para que la suma dé exacto.
4. Cada cuota siguiente cae en el ciclo del mes siguiente al anterior, con `date` = due_day de ese ciclo (según `card_billing_config` de ese mes o default).

### Recurrentes
1. Cada `recurring_template` define día del mes y monto estimado.
2. Al abrir el dashboard (o cualquier acción que dispare el check), una server action revisa todos los templates activos: si `day_of_month` ya pasó para el mes actual (o meses anteriores no generados), y no existe ya una `transaction` con ese `recurring_template_id` + año-mes, y no hay `recurring_skip` para ese año-mes, genera la transacción real (source=`recurring`).
3. Esta generación es idempotente (backfill de meses no abiertos previamente) y "ponerse al día" pasa solo con abrir la app.
4. Una vez generada, la fila es una transacción normal: editable/eliminable directamente sin afectar el template.
5. "Pausar para siempre" = `active = false` en el template (detiene generación futura, no toca transacciones pasadas).
6. "Saltear este mes" = insertar fila en `recurring_skips` antes de que se genere (o eliminar la transacción generada si ya existe — no se regenera porque la generación es por año-mes único).

### Proyección (dashboard)
Para "cuánto tengo que pagar los próximos N meses":
- Suma transacciones reales ya generadas con fecha futura (cuotas de tarjeta ya creadas al momento de la compra).
- Suma instancias virtuales (calculadas al vuelo, sin guardar en DB) de templates recurrentes activos que aún no vencieron ese mes — usando su `amount_estimate`.

## Pantallas

- **Dashboard:** balance mes actual (ingresos - gastos), proyección próximos 3 meses (real + virtual), gasto por categoría del mes, lista corta de próximos vencimientos.
- **Cargar movimiento:** form rápido — tipo, monto, categoría, fecha, método de pago; si tarjeta → selector de tarjeta + cantidad de cuotas (1 = contado).
- **Recurrentes:** listado activos/pausados, crear/editar/pausar/reactivar, saltear mes puntual.
- **Tarjetas:** CRUD tarjeta + default cierre/vencimiento, override mensual.
- **Categorías:** CRUD simple, tipo income/expense, creables libremente por el usuario.
- **Historial:** lista de movimientos filtrable por mes/categoría/tarjeta, edición/borrado de cualquier transacción (incluidas las generadas por recurrente o cuota individual).

## Error handling

- Validación de forms: monto > 0, categoría requerida, fecha válida.
- RLS de Supabase evita fuga de datos entre usuarios.

## Testing

- Tests unitarios para: cálculo de asignación de cuota a ciclo de facturación (dado closing_day/due_day y fecha de compra), generación recurrente (idempotencia, skip, pausa, backfill de meses atrasados).
- Sin e2e para el MVP.

## Fuera de alcance (MVP)

- Multi-moneda.
- Ingresos recurrentes (sueldo fijo) — se cargan a mano.
- Interés/recargo automático de cuotas — se carga el monto total ya con recargo si corresponde.
- Notificaciones/recordatorios.
