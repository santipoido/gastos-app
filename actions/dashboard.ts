'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { generatePendingRecurring } from '@/actions/recurring';
import { computeVirtualOccurrences } from '@/lib/recurring';
import { formatYearMonth, addMonthsToYearMonth } from '@/lib/billing';

export interface DashboardData {
  currentMonthIncome: number;
  currentMonthExpense: number;
  categoryBreakdown: { categoryId: string; categoryName: string; categoryColor: string | null; total: number }[];
  projection: { yearMonth: string; total: number }[];
  upcoming: { date: string; description: string; amount: number }[];
}

export async function getDashboardData(): Promise<DashboardData> {
  await generatePendingRecurring();

  const supabase = await createServerSupabase();
  const now = new Date();
  const currentYearMonth = formatYearMonth(now);
  const monthStart = `${currentYearMonth}-01`;
  const nextMonthStart = `${addMonthsToYearMonth(currentYearMonth, 1)}-01`;

  const { data: currentMonthTx, error: currentError } = await supabase
    .from('transactions')
    .select('type, amount, category_id, categories(name, color)')
    .eq('paid', true)
    .gte('date', monthStart)
    .lt('date', nextMonthStart);
  if (currentError) throw currentError;

  const currentMonthIncome = currentMonthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const currentMonthExpense = currentMonthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const breakdownMap = new Map<string, { categoryName: string; categoryColor: string | null; total: number }>();
  for (const t of currentMonthTx.filter((t) => t.type === 'expense')) {
    const category = t.categories as unknown as { name: string; color: string | null } | null;
    const existing = breakdownMap.get(t.category_id) ?? {
      categoryName: category?.name ?? 'Sin categoría',
      categoryColor: category?.color ?? null,
      total: 0,
    };
    existing.total += Number(t.amount);
    breakdownMap.set(t.category_id, existing);
  }
  const categoryBreakdown = Array.from(breakdownMap.entries()).map(([categoryId, v]) => ({
    categoryId,
    ...v,
  }));

  const monthsAhead = 3;
  const projectionEnd = addMonthsToYearMonth(currentYearMonth, monthsAhead);

  const { data: futureTx, error: futureError } = await supabase
    .from('transactions')
    .select('date, amount, type')
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', `${projectionEnd}-01`);
  if (futureError) throw futureError;

  const { data: activeTemplates, error: templatesError } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('active', true);
  if (templatesError) throw templatesError;

  const { data: generatedRows, error: generatedError } = await supabase
    .from('transactions')
    .select('recurring_template_id, date')
    .not('recurring_template_id', 'is', null);
  if (generatedError) throw generatedError;

  const virtualOccurrences = computeVirtualOccurrences({
    templates: activeTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      dayOfMonth: t.day_of_month,
      active: t.active,
      amountEstimate: t.amount_estimate,
      categoryId: t.category_id,
    })),
    fromYearMonth: currentYearMonth,
    monthsAhead,
    existing: generatedRows.map((r) => ({
      templateId: r.recurring_template_id as string,
      yearMonth: r.date.slice(0, 7),
    })),
  });

  const projectionMap = new Map<string, number>();
  for (let i = 0; i < monthsAhead; i++) {
    projectionMap.set(addMonthsToYearMonth(currentYearMonth, i), 0);
  }
  for (const t of futureTx) {
    const ym = t.date.slice(0, 7);
    projectionMap.set(ym, (projectionMap.get(ym) ?? 0) + Number(t.amount));
  }
  for (const occ of virtualOccurrences) {
    projectionMap.set(occ.yearMonth, (projectionMap.get(occ.yearMonth) ?? 0) + occ.amount);
  }
  const projection = Array.from(projectionMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, total]) => ({ yearMonth, total }));

  const upcomingReal = futureTx
    .filter((t) => t.date >= now.toISOString().slice(0, 10))
    .map((t) => ({ date: t.date, description: 'Movimiento', amount: Number(t.amount) }));
  const upcomingVirtual = virtualOccurrences.map((o) => ({
    date: o.date.toISOString().slice(0, 10),
    description: o.name,
    amount: o.amount,
  }));
  const upcoming = [...upcomingReal, ...upcomingVirtual]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  return { currentMonthIncome, currentMonthExpense, categoryBreakdown, projection, upcoming };
}
