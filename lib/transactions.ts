export type TransactionSource = 'manual' | 'recurring' | 'installment';

export function isPaidByDefault(source: TransactionSource): boolean {
  return source === 'manual';
}
