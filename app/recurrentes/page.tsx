import { listRecurringTemplates, generatePendingRecurring } from '@/actions/recurring';
import { listCategories } from '@/actions/categories';
import { RecurringTemplateForm } from '@/components/recurring-template-form';
import { RecurringTemplateRow } from '@/components/recurring-template-row';
import { Card, CardContent } from '@/components/ui/card';
import { formatYearMonth } from '@/lib/billing';

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
            <RecurringTemplateRow
              key={t.id}
              template={t}
              categories={categories}
              currentYearMonth={currentYearMonth}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
