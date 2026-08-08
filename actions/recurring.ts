'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { computePendingGenerations } from '@/lib/recurring';
import { formatYearMonth } from '@/lib/billing';
import { isPaidByDefault } from '@/lib/transactions';
import { revalidatePath } from 'next/cache';
import type { RecurringTemplate } from '@/lib/types';

export async function listRecurringTemplates(): Promise<RecurringTemplate[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .order('day_of_month');
  if (error) throw error;
  return data;
}

export async function createRecurringTemplate(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('recurring_templates').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    category_id: formData.get('category_id') as string,
    amount_estimate: Number(formData.get('amount_estimate')),
    day_of_month: Number(formData.get('day_of_month')),
  });
  if (error) throw error;
  revalidatePath('/recurrentes');
}

export async function pauseRecurringTemplate(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('recurring_templates')
    .update({ active: false, paused_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/recurrentes');
}

export async function resumeRecurringTemplate(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('recurring_templates')
    .update({ active: true, paused_at: null })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/recurrentes');
}

export async function skipRecurringMonth(templateId: string, yearMonth: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('recurring_skips')
    .insert({ template_id: templateId, year_month: yearMonth });
  if (error) throw error;

  await supabase
    .from('transactions')
    .delete()
    .eq('recurring_template_id', templateId)
    .gte('date', `${yearMonth}-01`);

  revalidatePath('/recurrentes');
  revalidatePath('/movimientos');
  revalidatePath('/dashboard');
}

export async function generatePendingRecurring(): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: templates, error: templatesError } = await supabase
    .from('recurring_templates')
    .select('*');
  if (templatesError) throw templatesError;

  const activeTemplates = templates.filter((t) => t.active);
  if (activeTemplates.length === 0) return;

  const { data: existingRows, error: existingError } = await supabase
    .from('transactions')
    .select('recurring_template_id, date')
    .not('recurring_template_id', 'is', null);
  if (existingError) throw existingError;

  const { data: skipRows, error: skipError } = await supabase
    .from('recurring_skips')
    .select('template_id, year_month');
  if (skipError) throw skipError;

  const today = new Date();
  const pending = computePendingGenerations({
    templates: activeTemplates.map((t) => ({
      id: t.id,
      dayOfMonth: t.day_of_month,
      active: t.active,
      amountEstimate: t.amount_estimate,
      categoryId: t.category_id,
    })),
    today,
    existing: existingRows.map((r) => ({
      templateId: r.recurring_template_id as string,
      yearMonth: r.date.slice(0, 7),
    })),
    skips: skipRows.map((s) => ({ templateId: s.template_id, yearMonth: s.year_month })),
    templateStartYearMonth: (templateId) => {
      const t = activeTemplates.find((t) => t.id === templateId)!;
      return formatYearMonth(new Date(t.created_at));
    },
  });

  if (pending.length === 0) return;

  const rows = pending.map((p) => ({
    user_id: user.id,
    type: 'expense' as const,
    amount: p.amount,
    date: p.date.toISOString().slice(0, 10),
    category_id: p.categoryId,
    payment_method: 'cash' as const,
    recurring_template_id: p.templateId,
    source: 'recurring' as const,
    paid: isPaidByDefault('recurring'),
  }));

  const { error: insertError } = await supabase.from('transactions').insert(rows);
  if (insertError) throw insertError;
}
