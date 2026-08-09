import { listTransactions, deleteTransaction } from '@/actions/transactions';
import { listCategories } from '@/actions/categories';
import { listCards } from '@/actions/cards';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
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

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {categoryById.get(t.category_id) ?? 'Sin categoría'}
                  {t.installment_total && t.installment_total > 1 ? ` (cuota ${t.installment_number}/${t.installment_total})` : ''}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {new Date(t.date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  {t.description ? ` · ${t.description}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`text-sm font-medium ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
                  {t.type === 'income' ? '+' : '-'}
                  {formatCurrency(Number(t.amount))}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href={`/movimientos/${t.id}/editar`} />}
                >
                  Editar
                </Button>
                <ConfirmDeleteButton
                  action={deleteTransaction.bind(null, t.id)}
                  confirmText="¿Borrar este movimiento?"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
