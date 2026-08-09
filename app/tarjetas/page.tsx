import { listCards } from '@/actions/cards';
import { CardForm } from '@/components/card-form';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default async function TarjetasPage() {
  const cards = await listCards();

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Tarjetas</h1>
      <CardForm />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {cards.map((c) => (
            <Link key={c.id} href={`/tarjetas/${c.id}`} className="block px-6 py-3">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                Cierre día {c.default_closing_day} · Vencimiento día {c.default_due_day}
                {c.default_due_month_offset === 1 ? ' del mes siguiente' : ' del mismo mes'}
              </p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
