'use client';

import { updateTransaction } from '@/actions/transactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Category, Transaction } from '@/lib/types';
import { useRouter } from 'next/navigation';

export function TransactionEditForm({
  transaction,
  categories,
}: {
  transaction: Transaction;
  categories: Category[];
}) {
  const router = useRouter();
  const filteredCategories = categories.filter((c) => c.type === transaction.type);

  return (
    <form
      action={async (formData) => {
        await updateTransaction(transaction.id, formData);
        router.push('/movimientos');
      }}
      className="mx-auto max-w-md space-y-4"
    >
      {transaction.installment_total && transaction.installment_total > 1 && (
        <p className="text-sm text-muted-foreground">
          Cuota {transaction.installment_number}/{transaction.installment_total} — editar solo cambia esta cuota.
        </p>
      )}

      <div>
        <Label htmlFor="amount">Monto</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={transaction.amount}
          required
        />
      </div>

      <div>
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" name="date" type="date" defaultValue={transaction.date} required />
      </div>

      <div>
        <Label htmlFor="description">Descripción</Label>
        <Input id="description" name="description" defaultValue={transaction.description ?? ''} />
      </div>

      <div>
        <Label>Categoría</Label>
        <Select
          name="category_id"
          defaultValue={transaction.category_id}
          required
          items={Object.fromEntries(filteredCategories.map((c) => [c.id, c.name]))}
        >
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

      <Button type="submit" className="w-full">Guardar</Button>
    </form>
  );
}
