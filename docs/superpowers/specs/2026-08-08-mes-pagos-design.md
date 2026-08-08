# Ruta /mes — Confirmación de pagos — Design Spec

Date: 2026-08-08
Status: Approved

## Problema

El dashboard cuenta como "gasto del mes" cualquier transacción con fecha en el mes actual, sin importar si ya se pagó de verdad. Esto pasa en dos casos:

- **Cuotas de tarjeta:** se insertan todas de una al momento de la compra (N filas con fecha futura, una por mes). Una cuota con vencimiento este mes ya cuenta como gasto aunque todavía no se pagó el resumen de la tarjeta.
- **Recurrentes:** se generan automáticamente como transacción real apenas pasa el `day_of_month`, aunque el usuario no haya pagado ese gasto todavía.

Se necesita distinguir "gasto comprometido/estimado" de "gasto efectivamente pagado", y una pantalla para confirmar pagos del mes.

## Modelo de datos

`transactions` gana una columna:

```sql
alter table transactions add column paid boolean not null default true;
```

Reglas de asignación al insertar:

- Manual efectivo (`payment_method = 'cash'`), ingresos: `paid = true` (ya ocurrió, se está registrando después del hecho).
- Cuotas de tarjeta (`payment_method = 'card'`, en `createTransaction`): `paid = false`.
- Generación de recurrentes (`generatePendingRecurring`, `source = 'recurring'`): `paid = false`.
- Filas históricas ya existentes en la base: quedan `true` por el default de la columna (no se retocan; evita que gastos ya contabilizados desaparezcan del balance al desplegar este cambio).

## Dashboard (`actions/dashboard.ts`)

Las queries que calculan `currentMonthIncome`, `currentMonthExpense` y `categoryBreakdown` agregan `.eq('paid', true)`.

`projection` y `upcoming` (próximos vencimientos) **no** filtran por `paid`: son vistas de compromisos a futuro, no de lo ya pagado, y no cambian.

## Acciones nuevas (`actions/month.ts`)

- `getMonthTransactions()`: trae todas las transacciones de tipo `expense` con fecha en el mes actual (tarjeta, recurrente y manual efectivo), ordenadas por fecha, con nombre de categoría.
- `toggleTransactionPaid(id: string, paid: boolean)`: server action, hace `update({ paid }).eq('id', id)`, revalida `/mes`, `/dashboard`, `/movimientos`.

## Ruta `/mes` (`app/mes/page.tsx`)

Mismo layout que el resto (`max-w-lg`, `Card` con filas `divide-y`, tokens `text-income`/`text-expense`).

- Dos secciones: **Pendientes** (paid=false, ordenadas por fecha) arriba, **Pagados** (paid=true) abajo.
- Cada fila: checkbox + categoría/nombre + fecha + monto.
  - Checkbox implementado como `<form action={toggleTransactionPaid.bind(null, id, !paid)}>` con un botón tipo submit estilizado como casilla (mismo patrón sin JS cliente que los botones "Borrar" existentes en el resto de la app).
  - Filas de origen manual (`source = 'manual'`, `payment_method = 'cash'`) aparecen en Pagados con el checkbox deshabilitado — no se pueden destildar.
  - Filas de tarjeta/recurrente se pueden tildar y destildar libremente entre ambas secciones.
- Se agrega `/mes` a `components/nav.tsx` (junto a Inicio/Movimientos/Recurrentes/Tarjetas/Categorías).

## Testing

- Test unitario para la regla de asignación de `paid` en `createTransaction` (card → false, cash → true) y en `generatePendingRecurring` (siempre false). Se agrega a la suite existente de billing/recurring (`lib/`), sin frameworks nuevos.

## Fuera de alcance

- No se listan ingresos ni movimientos manuales con tarjeta única (no existen en el modelo actual: tarjeta siempre pasa por `computeInstallmentSchedule`).
- No se toca la lógica de proyección a 3 meses ni "próximos vencimientos".
- No hay deshacer histórico automático: filas ya insertadas antes de este cambio quedan `paid = true`.
