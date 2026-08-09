'use client';

import { createCard, updateCard } from '@/actions/cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Card } from '@/lib/types';
import { useRef } from 'react';

export function CardForm({ card, onDone }: { card?: Card; onDone?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        if (card) {
          await updateCard(card.id, formData);
          onDone?.();
        } else {
          await createCard(formData);
          formRef.current?.reset();
        }
      }}
      className="grid grid-cols-4 gap-2"
    >
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={card?.name} required />
      </div>
      <div>
        <Label htmlFor="default_closing_day">Cierre (día)</Label>
        <Input
          id="default_closing_day"
          name="default_closing_day"
          type="number"
          min={1}
          max={31}
          defaultValue={card?.default_closing_day}
          required
        />
      </div>
      <div>
        <Label htmlFor="default_due_day">Vencimiento (día)</Label>
        <Input
          id="default_due_day"
          name="default_due_day"
          type="number"
          min={1}
          max={31}
          defaultValue={card?.default_due_day}
          required
        />
      </div>
      <div>
        <Label htmlFor="default_due_month_offset">Vencimiento en</Label>
        <select
          id="default_due_month_offset"
          name="default_due_month_offset"
          defaultValue={card?.default_due_month_offset ?? 1}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value={0}>Mismo mes</option>
          <option value={1}>Mes siguiente</option>
        </select>
      </div>
      <Button type="submit" className="col-span-4">
        {card ? 'Guardar cambios' : 'Agregar tarjeta'}
      </Button>
    </form>
  );
}
