'use client';

import { upsertBillingConfig } from '@/actions/cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function BillingOverrideForm({ cardId }: { cardId: string }) {
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <form action={upsertBillingConfig} className="grid grid-cols-5 gap-2">
      <input type="hidden" name="card_id" value={cardId} />
      <div>
        <Label htmlFor="year_month">Mes (AAAA-MM)</Label>
        <Input id="year_month" name="year_month" defaultValue={defaultYearMonth} required />
      </div>
      <div>
        <Label htmlFor="closing_day">Cierre</Label>
        <Input id="closing_day" name="closing_day" type="number" min={1} max={31} required />
      </div>
      <div>
        <Label htmlFor="due_day">Vencimiento</Label>
        <Input id="due_day" name="due_day" type="number" min={1} max={31} required />
      </div>
      <div>
        <Label htmlFor="due_month_offset">Vencimiento en</Label>
        <select
          id="due_month_offset"
          name="due_month_offset"
          defaultValue={1}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value={0}>Mismo mes</option>
          <option value={1}>Mes siguiente</option>
        </select>
      </div>
      <Button type="submit" className="self-end">Guardar</Button>
    </form>
  );
}
