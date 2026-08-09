'use client';

import { createTransaction } from '@/actions/transactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Category, Card } from '@/lib/types';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TransactionForm({ categories, cards }: { categories: Category[]; cards: Card[] }) {
  const router = useRouter();
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cardId, setCardId] = useState(cards[0]?.id ?? '');

  const filteredCategories = categories.filter((c) => c.type === type);

  return (
    <form
      action={async (formData) => {
        await createTransaction(formData);
        router.push('/movimientos');
      }}
      className="mx-auto max-w-md space-y-4"
    >
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="payment_method" value={paymentMethod} />

      <div className="flex gap-2">
        <Button type="button" variant={type === 'expense' ? 'default' : 'outline'} onClick={() => setType('expense')}>
          Gasto
        </Button>
        <Button type="button" variant={type === 'income' ? 'default' : 'outline'} onClick={() => setType('income')}>
          Ingreso
        </Button>
      </div>

      <div>
        <Label htmlFor="amount">Monto</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
      </div>

      <div>
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      </div>

      <div>
        <Label htmlFor="description">Descripción</Label>
        <Input id="description" name="description" />
      </div>

      <div>
        <Label>Categoría</Label>
        <Select
          name="category_id"
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

      <div className="flex gap-2">
        <Button type="button" variant={paymentMethod === 'cash' ? 'default' : 'outline'} onClick={() => setPaymentMethod('cash')}>
          Efectivo
        </Button>
        <Button type="button" variant={paymentMethod === 'card' ? 'default' : 'outline'} onClick={() => setPaymentMethod('card')}>
          Tarjeta
        </Button>
      </div>

      {paymentMethod === 'card' && (
        <>
          <div>
            <Label>Tarjeta</Label>
            <input type="hidden" name="card_id" value={cardId} />
            <Select
              value={cardId}
              onValueChange={(value) => setCardId(value ?? '')}
              items={Object.fromEntries(cards.map((c) => [c.id, c.name]))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="installments">Cuotas</Label>
            <Input id="installments" name="installments" type="number" min={1} max={24} defaultValue={1} />
          </div>
        </>
      )}

      <Button type="submit" className="w-full">Guardar</Button>
    </form>
  );
}
