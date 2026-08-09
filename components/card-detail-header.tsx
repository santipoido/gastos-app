'use client';

import { CardForm } from '@/components/card-form';
import { Button } from '@/components/ui/button';
import type { Card } from '@/lib/types';
import { useState } from 'react';

export function CardDetailHeader({ card }: { card: Card }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <CardForm card={card} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h1 className="text-xl font-semibold">{card.name}</h1>
        <p className="text-sm text-muted-foreground">
          Default: cierre día {card.default_closing_day}, vencimiento día {card.default_due_day}
          {card.default_due_month_offset === 1 ? ' del mes siguiente' : ' del mismo mes'}
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Editar
      </Button>
    </div>
  );
}
