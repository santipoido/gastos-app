import { describe, it, expect } from 'vitest';
import { isPaidByDefault } from './transactions';

describe('isPaidByDefault', () => {
  it('treats manual (cash) entries as already paid', () => {
    expect(isPaidByDefault('manual')).toBe(true);
  });

  it('treats card installments as pending until confirmed', () => {
    expect(isPaidByDefault('installment')).toBe(false);
  });

  it('treats generated recurring expenses as pending until confirmed', () => {
    expect(isPaidByDefault('recurring')).toBe(false);
  });
});
