'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { computeInstallmentSchedule } from '@/lib/billing';
import { isPaidByDefault } from '@/lib/transactions';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import type { Transaction } from '@/lib/types';

export async function createTransaction(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const type = formData.get('type') as 'income' | 'expense';
  const amount = Number(formData.get('amount'));
  const date = formData.get('date') as string;
  const description = (formData.get('description') as string) || null;
  const categoryId = formData.get('category_id') as string;
  const paymentMethod = formData.get('payment_method') as 'cash' | 'card';
  const cardId = (formData.get('card_id') as string) || null;
  const installments = Number(formData.get('installments') || 1);

  if (amount <= 0) throw new Error('El monto debe ser mayor a 0');

  if (paymentMethod === 'cash') {
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      type,
      amount,
      date,
      description,
      category_id: categoryId,
      payment_method: paymentMethod,
      card_id: null,
      source: 'manual',
      paid: isPaidByDefault('manual'),
    });
    if (error) throw error;
  } else {
    if (!cardId) throw new Error('Falta seleccionar tarjeta');

    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('default_closing_day, default_due_day, default_due_month_offset')
      .eq('id', cardId)
      .single();
    if (cardError) throw cardError;

    const { data: overrides, error: overridesError } = await supabase
      .from('card_billing_config')
      .select('year_month, closing_day, due_day, due_month_offset')
      .eq('card_id', cardId);
    if (overridesError) throw overridesError;

    const schedule = computeInstallmentSchedule({
      purchaseDate: new Date(`${date}T00:00:00Z`),
      totalAmount: amount,
      installments,
      card: {
        defaultClosingDay: card.default_closing_day,
        defaultDueDay: card.default_due_day,
        defaultDueMonthOffset: card.default_due_month_offset,
      },
      overrides: overrides.map((o) => ({
        yearMonth: o.year_month,
        closingDay: o.closing_day,
        dueDay: o.due_day,
        dueMonthOffset: o.due_month_offset,
      })),
    });

    const installmentGroupId = randomUUID();
    const rows = schedule.map((line) => ({
      user_id: user.id,
      type,
      amount: line.amount,
      date: line.dueDate.toISOString().slice(0, 10),
      description,
      category_id: categoryId,
      payment_method: 'card' as const,
      card_id: cardId,
      installment_group_id: installmentGroupId,
      installment_number: line.installmentNumber,
      installment_total: line.installmentTotal,
      source: 'installment' as const,
      paid: type === 'income' ? true : isPaidByDefault('installment'),
    }));

    const { error } = await supabase.from('transactions').insert(rows);
    if (error) throw error;
  }

  revalidatePath('/movimientos');
  revalidatePath('/dashboard');
}

export async function listTransactions(filters?: {
  categoryId?: string;
  cardId?: string;
  yearMonth?: string;
}): Promise<Transaction[]> {
  const supabase = await createServerSupabase();
  let query = supabase.from('transactions').select('*').order('date', { ascending: false });

  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters?.cardId) query = query.eq('card_id', filters.cardId);
  if (filters?.yearMonth) {
    query = query
      .gte('date', `${filters.yearMonth}-01`)
      .lt('date', `${addMonthPrefix(filters.yearMonth)}-01`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function addMonthPrefix(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return next;
}

export async function deleteTransaction(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/movimientos');
  revalidatePath('/dashboard');
}

export async function updateTransaction(id: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('transactions')
    .update({
      amount: Number(formData.get('amount')),
      date: formData.get('date') as string,
      description: (formData.get('description') as string) || null,
      category_id: formData.get('category_id') as string,
    })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/movimientos');
  revalidatePath('/dashboard');
}
