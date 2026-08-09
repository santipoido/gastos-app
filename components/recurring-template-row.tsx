'use client';

import { pauseRecurringTemplate, resumeRecurringTemplate, skipRecurringMonth } from '@/actions/recurring';
import { RecurringTemplateForm } from '@/components/recurring-template-form';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import type { Category, RecurringTemplate } from '@/lib/types';
import { useState } from 'react';

export function RecurringTemplateRow({
  template,
  categories,
  currentYearMonth,
}: {
  template: RecurringTemplate;
  categories: Category[];
  currentYearMonth: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="px-6 py-3">
        <RecurringTemplateForm categories={categories} template={template} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-2 px-6 py-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{template.name}</p>
        <span className="text-xs text-muted-foreground">{template.active ? 'Activo' : 'Pausado'}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Día {template.day_of_month} · {formatCurrency(Number(template.amount_estimate))}
      </p>
      <div className="flex flex-wrap gap-2">
        {template.active ? (
          <form action={pauseRecurringTemplate.bind(null, template.id)}>
            <Button type="submit" variant="outline" size="sm">Pausar para siempre</Button>
          </form>
        ) : (
          <form action={resumeRecurringTemplate.bind(null, template.id)}>
            <Button type="submit" variant="outline" size="sm">Reactivar</Button>
          </form>
        )}
        <form action={skipRecurringMonth.bind(null, template.id, currentYearMonth)}>
          <Button type="submit" variant="ghost" size="sm">Saltear este mes</Button>
        </form>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Editar
        </Button>
      </div>
    </div>
  );
}
