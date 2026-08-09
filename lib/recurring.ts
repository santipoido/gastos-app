import { addMonthsToYearMonth, clampDay, formatYearMonth, type YearMonth } from './billing';

export interface RecurringTemplateLike {
  id: string;
  dayOfMonth: number;
  active: boolean;
  amountEstimate: number;
  categoryId: string;
}

export interface ExistingGeneration {
  templateId: string;
  yearMonth: YearMonth;
}

export interface SkipEntry {
  templateId: string;
  yearMonth: YearMonth;
}

export function monthsBetweenInclusive(start: YearMonth, end: YearMonth): YearMonth[] {
  const result: YearMonth[] = [];
  let current = start;
  while (current <= end) {
    result.push(current);
    current = addMonthsToYearMonth(current, 1);
  }
  return result;
}

export interface PendingGeneration {
  templateId: string;
  yearMonth: YearMonth;
  date: Date;
  amount: number;
  categoryId: string;
}

export function computePendingGenerations(params: {
  templates: RecurringTemplateLike[];
  today: Date;
  existing: ExistingGeneration[];
  skips: SkipEntry[];
  templateStartYearMonth: (templateId: string) => YearMonth;
}): PendingGeneration[] {
  const { templates, today, existing, skips, templateStartYearMonth } = params;
  const todayYearMonth = formatYearMonth(today);
  const pending: PendingGeneration[] = [];

  for (const t of templates) {
    if (!t.active) continue;
    const startYearMonth = templateStartYearMonth(t.id);
    const months = monthsBetweenInclusive(startYearMonth, todayYearMonth);

    for (const yearMonth of months) {
      const dueDate = clampDay(yearMonth, t.dayOfMonth);
      if (dueDate.getTime() > today.getTime()) continue;

      const alreadyGenerated = existing.some(
        (e) => e.templateId === t.id && e.yearMonth === yearMonth
      );
      if (alreadyGenerated) continue;

      const skipped = skips.some((s) => s.templateId === t.id && s.yearMonth === yearMonth);
      if (skipped) continue;

      pending.push({
        templateId: t.id,
        yearMonth,
        date: dueDate,
        amount: t.amountEstimate,
        categoryId: t.categoryId,
      });
    }
  }

  return pending;
}

export interface VirtualOccurrence {
  templateId: string;
  yearMonth: YearMonth;
  date: Date;
  amount: number;
  categoryId: string;
  name: string;
}

export function computeVirtualOccurrences(params: {
  templates: (RecurringTemplateLike & { name: string })[];
  fromYearMonth: YearMonth;
  monthsAhead: number;
  existing: ExistingGeneration[];
}): VirtualOccurrence[] {
  const { templates, fromYearMonth, monthsAhead, existing } = params;
  const result: VirtualOccurrence[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const yearMonth = addMonthsToYearMonth(fromYearMonth, i);
    for (const t of templates) {
      if (!t.active) continue;
      const alreadyGenerated = existing.some(
        (e) => e.templateId === t.id && e.yearMonth === yearMonth
      );
      if (alreadyGenerated) continue;

      result.push({
        templateId: t.id,
        yearMonth,
        date: clampDay(yearMonth, t.dayOfMonth),
        amount: t.amountEstimate,
        categoryId: t.categoryId,
        name: t.name,
      });
    }
  }

  return result;
}
