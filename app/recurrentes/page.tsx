import { listRecurringTemplates, pauseRecurringTemplate, resumeRecurringTemplate, skipRecurringMonth, generatePendingRecurring } from '@/actions/recurring';
import { listCategories } from '@/actions/categories';
import { RecurringTemplateForm } from '@/components/recurring-template-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatYearMonth } from '@/lib/billing';
import { formatCurrency } from '@/lib/format';

export default async function RecurrentesPage() {
  await generatePendingRecurring();
  const [templates, categories] = await Promise.all([listRecurringTemplates(), listCategories()]);
  const currentYearMonth = formatYearMonth(new Date());

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Gastos recurrentes</h1>
      <RecurringTemplateForm categories={categories} />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {templates.map((t) => (
            <div key={t.id} className="space-y-2 px-6 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t.name}</p>
                <span className="text-xs text-muted-foreground">{t.active ? 'Activo' : 'Pausado'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Día {t.day_of_month} · {formatCurrency(Number(t.amount_estimate))}
              </p>
              <div className="flex gap-2">
                {t.active ? (
                  <form action={pauseRecurringTemplate.bind(null, t.id)}>
                    <Button type="submit" variant="outline" size="sm">Pausar para siempre</Button>
                  </form>
                ) : (
                  <form action={resumeRecurringTemplate.bind(null, t.id)}>
                    <Button type="submit" variant="outline" size="sm">Reactivar</Button>
                  </form>
                )}
                <form action={skipRecurringMonth.bind(null, t.id, currentYearMonth)}>
                  <Button type="submit" variant="ghost" size="sm">Saltear este mes</Button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
