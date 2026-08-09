import { getMonthTransactions, toggleTransactionPaid, confirmVirtualRecurring, type MonthItem } from '@/actions/month';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatYearMonth, addMonthsToYearMonth } from '@/lib/billing';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const sourceLabel: Record<MonthItem['source'], string> = {
  manual: 'Efectivo',
  installment: 'Tarjeta',
  recurring: 'Recurrente',
};

function Row({ t, yearMonth }: { t: MonthItem; yearMonth: string }) {
  const locked = t.source === 'manual';
  const toggleAction =
    t.kind === 'virtual'
      ? confirmVirtualRecurring.bind(null, t.templateId as string, yearMonth)
      : toggleTransactionPaid.bind(null, t.id as string, !t.paid);

  return (
    <div className="flex items-center gap-3 px-6 py-3">
      <form action={toggleAction}>
        <Button
          type="submit"
          variant={t.paid ? 'default' : 'outline'}
          size="icon-sm"
          disabled={locked}
          aria-label={t.paid ? 'Marcar como pendiente' : 'Marcar como pagado'}
        >
          {t.paid && <Check className="size-3.5" />}
        </Button>
      </form>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {t.category_name}
          {t.installment_total && t.installment_total > 1
            ? ` (cuota ${t.installment_number}/${t.installment_total})`
            : ''}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {new Date(t.date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} ·{' '}
          {sourceLabel[t.source]}
          {t.kind === 'virtual' ? ' (estimado)' : ''}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-expense">${t.amount.toFixed(2)}</span>
    </div>
  );
}

export default async function MesPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const { ym } = await searchParams;
  const yearMonth = ym ?? formatYearMonth(new Date());
  const prevYearMonth = addMonthsToYearMonth(yearMonth, -1);
  const nextYearMonth = addMonthsToYearMonth(yearMonth, 1);
  const monthLabel = new Date(`${yearMonth}-01T00:00:00`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const transactions = await getMonthTransactions(yearMonth);
  const pending = transactions.filter((t) => !t.paid);
  const paid = transactions.filter((t) => t.paid);

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Mes</h1>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon-sm"
          render={<Link href={`/mes?ym=${prevYearMonth}`} aria-label="Mes anterior" />}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{monthLabel}</span>
        <Button
          variant="outline"
          size="icon-sm"
          render={<Link href={`/mes?ym=${nextYearMonth}`} aria-label="Mes siguiente" />}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Pendientes</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {pending.length === 0 && (
            <p className="px-6 py-3 text-sm text-muted-foreground">Nada pendiente este mes.</p>
          )}
          {pending.map((t) => <Row key={t.key} t={t} yearMonth={yearMonth} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pagados</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {paid.length === 0 && (
            <p className="px-6 py-3 text-sm text-muted-foreground">Todavía no confirmaste ningún pago este mes.</p>
          )}
          {paid.map((t) => <Row key={t.key} t={t} yearMonth={yearMonth} />)}
        </CardContent>
      </Card>
    </div>
  );
}
