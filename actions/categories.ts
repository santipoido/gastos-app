'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Category } from '@/lib/types';

export async function listCategories(): Promise<Category[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function createCategory(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    color: (formData.get('color') as string) || null,
  });
  if (error) throw error;
  revalidatePath('/categorias');
}

export async function deleteCategory(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/categorias');
}
