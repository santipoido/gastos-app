'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { generatePendingRecurring } from '@/actions/recurring';
import { formatYearMonth, addMonthsToYearMonth, clampDay } from '@/lib/billing';
import { computeVirtualOccurrences } from '@/lib/recurring';
import { revalidatePath } from 'next/cache';

export interface MonthItem {
  key: string;
  kind: 'real' | 'virtual';
  id: string | null;
  templateId: string | null;
  category_name: string;
  description: string | null;
  date: string;
  amount: number;
  paid: boolean;
  source: 'manual' | 'recurring' | 'installment';
  installment_number: number | null;
  installment_total: number | null;
}

export async function getMonthTransactions(yearMonth?: string): Promise<MonthItem[]> {
  await generatePendingRecurring();

  const supabase = await createServerSupabase();
  const targetYearMonth = yearMonth ?? formatYearMonth(new Date());
  const monthStart = `${targetYearMonth}-01`;
  const nextMonthStart = `${addMonthsToYearMonth(targetYearMonth, 1)}-01`;

  const { data: rows, error } = await supabase
    .from('transactions')
    .select('*, categories(name)')
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', nextMonthStart)
    .order('date');
  if (error) throw error;

  const real: MonthItem[] = rows.map((t) => ({
    key: t.id,
    kind: 'real',
    id: t.id,
    templateId: t.recurring_template_id,
    category_name: (t.categories as unknown as { name: string } | null)?.name ?? 'Sin categoría',
    description: t.description,
    date: t.date,
    amount: Number(t.amount),
    paid: t.paid,
    source: t.source,
    installment_number: t.installment_number,
    installment_total: t.installment_total,
  }));

  const { data: templates, error: templatesError } = await supabase
    .from('recurring_templates')
    .select('*, categories(name)')
    .eq('active', true);
  if (templatesError) throw templatesError;

  const existing = real
    .filter((t) => t.templateId)
    .map((t) => ({ templateId: t.templateId as string, yearMonth: targetYearMonth }));

  const virtualOccurrences = computeVirtualOccurrences({
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      dayOfMonth: t.day_of_month,
      active: t.active,
      amountEstimate: Number(t.amount_estimate),
      categoryId: t.category_id,
    })),
    fromYearMonth: targetYearMonth,
    monthsAhead: 1,
    existing,
  });

  const virtual: MonthItem[] = virtualOccurrences.map((o) => {
    const template = templates.find((t) => t.id === o.templateId)!;
    return {
      key: `virtual-${o.templateId}-${targetYearMonth}`,
      kind: 'virtual',
      id: null,
      templateId: o.templateId,
      category_name: (template.categories as unknown as { name: string } | null)?.name ?? 'Sin categoría',
      description: o.name,
      date: o.date.toISOString().slice(0, 10),
      amount: o.amount,
      paid: false,
      source: 'recurring',
      installment_number: null,
      installment_total: null,
    };
  });

  return [...real, ...virtual].sort((a, b) => a.date.localeCompare(b.date));
}

export async function toggleTransactionPaid(id: string, paid: boolean) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('transactions').update({ paid }).eq('id', id);
  if (error) throw error;
  revalidatePath('/mes');
  revalidatePath('/dashboard');
  revalidatePath('/movimientos');
}

export async function confirmVirtualRecurring(templateId: string, yearMonth: string) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: template, error: templateError } = await supabase
    .from('recurring_templates')
    .select('day_of_month, amount_estimate, category_id')
    .eq('id', templateId)
    .single();
  if (templateError) throw templateError;

  const date = clampDay(yearMonth, template.day_of_month);

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'expense',
    amount: template.amount_estimate,
    date: date.toISOString().slice(0, 10),
    category_id: template.category_id,
    payment_method: 'cash',
    recurring_template_id: templateId,
    source: 'recurring',
    paid: true,
  });
  if (error) throw error;

  revalidatePath('/mes');
  revalidatePath('/dashboard');
  revalidatePath('/movimientos');
  revalidatePath('/recurrentes');
}
