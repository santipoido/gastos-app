export type YearMonth = string; // 'YYYY-MM'

export interface CardDefaults {
  defaultClosingDay: number;
  defaultDueDay: number;
  /** 0 = due date falls in the same month as closing, 1 = the following month. */
  defaultDueMonthOffset: number;
}

export interface BillingOverride {
  yearMonth: YearMonth;
  closingDay: number;
  dueDay: number;
  dueMonthOffset: number;
}

export interface BillingConfig {
  closingDay: number;
  dueDay: number;
  dueMonthOffset: number;
}

export function formatYearMonth(date: Date): YearMonth {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function addMonthsToYearMonth(yearMonth: YearMonth, months: number): YearMonth {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return formatYearMonth(d);
}

export function clampDay(yearMonth: YearMonth, day: number): Date {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const clamped = Math.min(day, daysInMonth);
  return new Date(Date.UTC(y, m - 1, clamped));
}

export function resolveBillingConfig(
  yearMonth: YearMonth,
  card: CardDefaults,
  overrides: BillingOverride[]
): BillingConfig {
  const override = overrides.find((o) => o.yearMonth === yearMonth);
  if (override) {
    return { closingDay: override.closingDay, dueDay: override.dueDay, dueMonthOffset: override.dueMonthOffset };
  }
  return {
    closingDay: card.defaultClosingDay,
    dueDay: card.defaultDueDay,
    dueMonthOffset: card.defaultDueMonthOffset,
  };
}

export interface InstallmentLine {
  installmentNumber: number;
  installmentTotal: number;
  amount: number;
  dueDate: Date;
}

export function computeInstallmentSchedule(params: {
  purchaseDate: Date;
  totalAmount: number;
  installments: number;
  card: CardDefaults;
  overrides: BillingOverride[];
}): InstallmentLine[] {
  const { purchaseDate, totalAmount, installments, card, overrides } = params;

  const purchaseYearMonth = formatYearMonth(purchaseDate);
  const purchaseConfig = resolveBillingConfig(purchaseYearMonth, card, overrides);
  const closingDate = clampDay(purchaseYearMonth, purchaseConfig.closingDay);

  const firstCycleYearMonth =
    purchaseDate.getTime() <= closingDate.getTime()
      ? purchaseYearMonth
      : addMonthsToYearMonth(purchaseYearMonth, 1);

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainderCents = totalCents - baseCents * installments;

  const lines: InstallmentLine[] = [];
  for (let i = 0; i < installments; i++) {
    const cycleYearMonth = addMonthsToYearMonth(firstCycleYearMonth, i);
    const config = resolveBillingConfig(cycleYearMonth, card, overrides);
    const dueYearMonth = addMonthsToYearMonth(cycleYearMonth, config.dueMonthOffset);
    const dueDate = clampDay(dueYearMonth, config.dueDay);
    const cents = baseCents + (i === installments - 1 ? remainderCents : 0);
    lines.push({
      installmentNumber: i + 1,
      installmentTotal: installments,
      amount: cents / 100,
      dueDate,
    });
  }
  return lines;
}
