import { describe, it, expect } from 'vitest';
import {
  formatYearMonth,
  addMonthsToYearMonth,
  clampDay,
  resolveBillingConfig,
  computeInstallmentSchedule,
} from './billing';

describe('formatYearMonth', () => {
  it('pads single-digit months', () => {
    expect(formatYearMonth(new Date(Date.UTC(2026, 0, 15)))).toBe('2026-01');
  });
});

describe('addMonthsToYearMonth', () => {
  it('rolls over into the next year', () => {
    expect(addMonthsToYearMonth('2026-11', 2)).toBe('2027-01');
  });
});

describe('clampDay', () => {
  it('clamps to the last day of a short month', () => {
    const d = clampDay('2026-02', 31);
    expect(d.getUTCDate()).toBe(28);
  });
  it('keeps the exact day when it fits', () => {
    const d = clampDay('2026-08', 15);
    expect(d.getUTCDate()).toBe(15);
  });
});

describe('resolveBillingConfig', () => {
  it('uses the override when present', () => {
    const config = resolveBillingConfig(
      '2026-08',
      { defaultClosingDay: 20, defaultDueDay: 10, defaultDueMonthOffset: 1 },
      [{ yearMonth: '2026-08', closingDay: 25, dueDay: 12, dueMonthOffset: 0 }]
    );
    expect(config).toEqual({ closingDay: 25, dueDay: 12, dueMonthOffset: 0 });
  });
  it('falls back to card defaults', () => {
    const config = resolveBillingConfig(
      '2026-09',
      { defaultClosingDay: 20, defaultDueDay: 10, defaultDueMonthOffset: 1 },
      [{ yearMonth: '2026-08', closingDay: 25, dueDay: 12, dueMonthOffset: 0 }]
    );
    expect(config).toEqual({ closingDay: 20, dueDay: 10, dueMonthOffset: 1 });
  });
});

describe('computeInstallmentSchedule', () => {
  // Matches a typical AR card: closes the 20th, due the 10th of the FOLLOWING month.
  const card = { defaultClosingDay: 20, defaultDueDay: 10, defaultDueMonthOffset: 1 };

  it('puts a purchase before closing in the current cycle, due date rolls to next month', () => {
    const lines = computeInstallmentSchedule({
      purchaseDate: new Date(Date.UTC(2026, 7, 10)), // Aug 10
      totalAmount: 110000,
      installments: 1,
      card,
      overrides: [],
    });
    expect(lines).toHaveLength(1);
    // Cycle is August (purchase before closing), due date is September per dueMonthOffset=1.
    expect(formatYearMonth(lines[0].dueDate)).toBe('2026-09');
    expect(lines[0].dueDate.getUTCDate()).toBe(10);
    expect(lines[0].amount).toBe(110000);
  });

  it("puts a purchase after closing in next month's cycle, due date two months out", () => {
    const lines = computeInstallmentSchedule({
      purchaseDate: new Date(Date.UTC(2026, 7, 25)), // Aug 25, closing was Aug 20
      totalAmount: 90000,
      installments: 1,
      card,
      overrides: [],
    });
    // Cycle is September (purchase after closing), due date is October.
    expect(formatYearMonth(lines[0].dueDate)).toBe('2026-10');
  });

  it('splits into equal installments across consecutive cycles, adjusting the last for rounding', () => {
    const lines = computeInstallmentSchedule({
      purchaseDate: new Date(Date.UTC(2026, 7, 10)),
      totalAmount: 100,
      installments: 3,
      card,
      overrides: [],
    });
    expect(lines.map((l) => l.amount)).toEqual([33.33, 33.33, 33.34]);
    // Cycles are Aug, Sep, Oct; due dates (offset +1) are Sep, Oct, Nov.
    expect(lines.map((l) => formatYearMonth(l.dueDate))).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('respects a per-month override on a later installment cycle', () => {
    const lines = computeInstallmentSchedule({
      purchaseDate: new Date(Date.UTC(2026, 7, 10)),
      totalAmount: 200,
      installments: 2,
      card,
      overrides: [{ yearMonth: '2026-09', closingDay: 20, dueDay: 15, dueMonthOffset: 1 }],
    });
    expect(lines[1].dueDate.getUTCDate()).toBe(15);
  });

  it('supports a card whose due date falls in the same month as closing', () => {
    const sameMonthCard = { defaultClosingDay: 5, defaultDueDay: 20, defaultDueMonthOffset: 0 };
    const lines = computeInstallmentSchedule({
      purchaseDate: new Date(Date.UTC(2026, 7, 1)), // Aug 1, before closing (Aug 5)
      totalAmount: 50000,
      installments: 1,
      card: sameMonthCard,
      overrides: [],
    });
    expect(formatYearMonth(lines[0].dueDate)).toBe('2026-08');
    expect(lines[0].dueDate.getUTCDate()).toBe(20);
  });
});
