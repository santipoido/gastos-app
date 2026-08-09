'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Card, CardBillingConfig } from '@/lib/types';

export async function listCards(): Promise<Card[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from('cards').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function getCard(id: string): Promise<Card> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from('cards').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createCard(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('cards').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    default_closing_day: Number(formData.get('default_closing_day')),
    default_due_day: Number(formData.get('default_due_day')),
    default_due_month_offset: Number(formData.get('default_due_month_offset')),
  });
  if (error) throw error;
  revalidatePath('/tarjetas');
}

export async function updateCard(id: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('cards')
    .update({
      name: formData.get('name') as string,
      default_closing_day: Number(formData.get('default_closing_day')),
      default_due_day: Number(formData.get('default_due_day')),
      default_due_month_offset: Number(formData.get('default_due_month_offset')),
    })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/tarjetas');
  revalidatePath(`/tarjetas/${id}`);
}

export async function listBillingConfigs(cardId: string): Promise<CardBillingConfig[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('card_billing_config')
    .select('*')
    .eq('card_id', cardId)
    .order('year_month');
  if (error) throw error;
  return data;
}

export async function upsertBillingConfig(formData: FormData) {
  const supabase = await createServerSupabase();
  const cardId = formData.get('card_id') as string;

  const { error } = await supabase
    .from('card_billing_config')
    .upsert(
      {
        card_id: cardId,
        year_month: formData.get('year_month') as string,
        closing_day: Number(formData.get('closing_day')),
        due_day: Number(formData.get('due_day')),
        due_month_offset: Number(formData.get('due_month_offset')),
      },
      { onConflict: 'card_id,year_month' }
    );
  if (error) throw error;
  revalidatePath(`/tarjetas/${cardId}`);
}
