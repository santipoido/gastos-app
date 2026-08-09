import { getCard, listBillingConfigs } from '@/actions/cards';
import { BillingOverrideForm } from '@/components/billing-override-form';
import { CardDetailHeader } from '@/components/card-detail-header';
import { Card, CardContent } from '@/components/ui/card';

export default async function TarjetaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [card, configs] = await Promise.all([getCard(id), listBillingConfigs(id)]);

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <CardDetailHeader card={card} />
      <h2 className="font-medium">Override por mes</h2>
      <BillingOverrideForm cardId={card.id} />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {configs.map((cfg) => (
            <div key={cfg.id} className="px-6 py-3 text-sm">
              <span className="font-medium">{cfg.year_month}</span>
              <span className="text-muted-foreground">
                {' '}— cierre {cfg.closing_day}, vencimiento {cfg.due_day}
                {cfg.due_month_offset === 1 ? ' (mes siguiente)' : ' (mismo mes)'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
