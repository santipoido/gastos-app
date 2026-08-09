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
