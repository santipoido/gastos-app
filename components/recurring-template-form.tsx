'use client';

import { createRecurringTemplate, updateRecurringTemplate } from '@/actions/recurring';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Category, RecurringTemplate } from '@/lib/types';
import { useRef } from 'react';

export function RecurringTemplateForm({
  categories,
  template,
  onDone,
}: {
  categories: Category[];
  template?: RecurringTemplate;
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        if (template) {
          await updateRecurringTemplate(template.id, formData);
          onDone?.();
        } else {
          await createRecurringTemplate(formData);
          formRef.current?.reset();
        }
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" placeholder="Seguro auto" defaultValue={template?.name} required />
      </div>
      <div>
        <Label htmlFor="amount_estimate">Monto aproximado</Label>
        <Input
          id="amount_estimate"
          name="amount_estimate"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={template?.amount_estimate}
          required
        />
      </div>
      <div>
        <Label htmlFor="day_of_month">Día del mes</Label>
        <Input
          id="day_of_month"
          name="day_of_month"
          type="number"
          min={1}
          max={31}
          defaultValue={template?.day_of_month}
          required
        />
      </div>
      <div>
        <Label>Categoría</Label>
        <Select
          name="category_id"
          defaultValue={template?.category_id}
          required
          items={Object.fromEntries(expenseCategories.map((c) => [c.id, c.name]))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Elegí una categoría" />
          </SelectTrigger>
          <SelectContent>
            {expenseCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">{template ? 'Guardar cambios' : 'Crear recurrente'}</Button>
    </form>
  );
}
