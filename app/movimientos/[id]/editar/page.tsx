import { getTransaction } from '@/actions/transactions';
import { listCategories } from '@/actions/categories';
import { TransactionEditForm } from '@/components/transaction-edit-form';

export default async function EditarMovimientoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [transaction, categories] = await Promise.all([getTransaction(id), listCategories()]);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Editar movimiento</h1>
      <TransactionEditForm transaction={transaction} categories={categories} />
    </div>
  );
}
