import { listTransactions, deleteTransaction } from '@/actions/transactions';
import { listCategories } from '@/actions/categories';
import { listCards } from '@/actions/cards';
import { CategoryDot } from '@/components/category-dot';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; cardId?: string; yearMonth?: string; page?: string }>;
}) {
  const filters = await searchParams;
  const page = Math.max(1, Number(filters.page) || 1);
  const [{ transactions, hasNext }, categories, cards] = await Promise.all([
    listTransactions({ ...filters, page }),
    listCategories(),
    listCards(),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.cardId) params.set('cardId', filters.cardId);
    if (filters.yearMonth) params.set('yearMonth', filters.yearMonth);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/movimientos?${qs}` : '/movimientos';
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <Link href="/movimientos/nuevo"><Button>Nuevo</Button></Link>
      </div>

      <form className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap" method="get">
        <select name="categoryId" defaultValue={filters.categoryId ?? ''} className="w-full rounded border p-1 sm:w-auto">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="cardId" defaultValue={filters.cardId ?? ''} className="w-full rounded border p-1 sm:w-auto">
          <option value="">Todas las tarjetas</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input name="yearMonth" type="month" defaultValue={filters.yearMonth ?? ''} className="w-full rounded border p-1 sm:w-auto" />
        <Button type="submit" variant="outline" size="sm" className="col-span-2 w-full sm:col-span-1 sm:w-auto">Filtrar</Button>
      </form>

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  <CategoryDot color={categoryById.get(t.category_id)?.color ?? null} />
                  {categoryById.get(t.category_id)?.name ?? 'Sin categoría'}
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
                  size="icon-sm"
                  render={<Link href={`/movimientos/${t.id}/editar`} />}
                >
                  <Pencil />
                  <span className="sr-only">Editar</span>
                </Button>
                <ConfirmDeleteButton
                  action={deleteTransaction.bind(null, t.id)}
                  confirmText="¿Borrar este movimiento?"
                  size="icon-sm"
                >
                  <Trash2 />
                  <span className="sr-only">Borrar</span>
                </ConfirmDeleteButton>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        {page > 1 ? (
          <Button variant="outline" size="sm" render={<Link href={pageHref(page - 1)} />}>Anterior</Button>
        ) : (
          <Button variant="outline" size="sm" disabled>Anterior</Button>
        )}
        <span className="text-sm text-muted-foreground">Página {page}</span>
        {hasNext ? (
          <Button variant="outline" size="sm" render={<Link href={pageHref(page + 1)} />}>Siguiente</Button>
        ) : (
          <Button variant="outline" size="sm" disabled>Siguiente</Button>
        )}
      </div>
    </div>
  );
}
