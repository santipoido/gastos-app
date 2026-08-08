export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string | null;
  icon: string | null;
}

export interface Card {
  id: string;
  name: string;
  default_closing_day: number;
  default_due_day: number;
  default_due_month_offset: number;
}

export interface CardBillingConfig {
  id: string;
  card_id: string;
  year_month: string;
  closing_day: number;
  due_day: number;
  due_month_offset: number;
}

export interface RecurringTemplate {
  id: string;
  name: string;
  category_id: string;
  amount_estimate: number;
  day_of_month: number;
  active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  description: string | null;
  category_id: string;
  payment_method: 'cash' | 'card';
  card_id: string | null;
  installment_group_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  recurring_template_id: string | null;
  source: 'manual' | 'recurring' | 'installment';
  paid: boolean;
}
