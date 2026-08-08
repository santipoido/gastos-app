import { getMonthTransactions, toggleTransactionPaid, type MonthTransaction } from '@/actions/month';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

const sourceLabel: Record<MonthTransaction['source'], string> = {
  manual: 'Efectivo',
  installment: 'Tarjeta',
  recurring: 'Recurrente',
};

function Row({ t }: { t: MonthTransaction }) {
  const locked = t.source === 'manual';
  return (
    <div className="flex items-center gap-3 px-6 py-3">
      <form action={toggleTransactionPaid.bind(null, t.id, !t.paid)}>
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
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-expense">${Number(t.amount).toFixed(2)}</span>
    </div>
  );
}

export default async function MesPage() {
  const transactions = await getMonthTransactions();
  const pending = transactions.filter((t) => !t.paid);
  const paid = transactions.filter((t) => t.paid);

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Mes</h1>

      <Card>
        <CardHeader><CardTitle>Pendientes</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {pending.length === 0 && (
            <p className="px-6 py-3 text-sm text-muted-foreground">Nada pendiente este mes.</p>
          )}
          {pending.map((t) => <Row key={t.id} t={t} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pagados</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {paid.length === 0 && (
            <p className="px-6 py-3 text-sm text-muted-foreground">Todavía no confirmaste ningún pago este mes.</p>
          )}
          {paid.map((t) => <Row key={t.id} t={t} />)}
        </CardContent>
      </Card>
    </div>
  );
}
