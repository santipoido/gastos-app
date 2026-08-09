'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { generatePendingRecurring } from '@/actions/recurring';
import { formatYearMonth, addMonthsToYearMonth } from '@/lib/billing';
import { revalidatePath } from 'next/cache';
import type { Transaction } from '@/lib/types';

export interface MonthTransaction extends Transaction {
  category_name: string;
}

export async function getMonthTransactions(): Promise<MonthTransaction[]> {
  await generatePendingRecurring();

  const supabase = await createServerSupabase();
  const currentYearMonth = formatYearMonth(new Date());
  const monthStart = `${currentYearMonth}-01`;
  const nextMonthStart = `${addMonthsToYearMonth(currentYearMonth, 1)}-01`;

  const { data, error } = await supabase
    .from('transactions')
    .select('*, categories(name)')
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', nextMonthStart)
    .order('date');
  if (error) throw error;

  return data.map((t) => ({
    ...t,
    category_name: (t.categories as unknown as { name: string } | null)?.name ?? 'Sin categoría',
  }));
}

export async function toggleTransactionPaid(id: string, paid: boolean) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('transactions').update({ paid }).eq('id', id);
  if (error) throw error;
  revalidatePath('/mes');
  revalidatePath('/dashboard');
  revalidatePath('/movimientos');
}
