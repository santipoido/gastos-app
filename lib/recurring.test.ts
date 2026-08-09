import { describe, it, expect } from 'vitest';
import { monthsBetweenInclusive, computePendingGenerations, computeVirtualOccurrences } from './recurring';

describe('monthsBetweenInclusive', () => {
  it('lists every month including both ends', () => {
    expect(monthsBetweenInclusive('2026-06', '2026-08')).toEqual(['2026-06', '2026-07', '2026-08']);
  });
  it('returns a single month when start equals end', () => {
    expect(monthsBetweenInclusive('2026-08', '2026-08')).toEqual(['2026-08']);
  });
});

describe('computePendingGenerations', () => {
  const template = {
    id: 't1',
    dayOfMonth: 15,
    active: true,
    amountEstimate: 85000,
    categoryId: 'cat1',
  };

  it('generates for the current month once the day has passed', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 7, 20)), // Aug 20
      existing: [],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ templateId: 't1', yearMonth: '2026-08', amount: 85000 });
  });

  it('does not generate before the day has arrived', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 7, 10)), // Aug 10
      existing: [],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(0);
  });

  it('backfills missed months', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 9, 1)), // Oct 1
      existing: [],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending.map((p) => p.yearMonth)).toEqual(['2026-08', '2026-09']);
  });

  it('skips months already generated', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 7, 20)),
      existing: [{ templateId: 't1', yearMonth: '2026-08' }],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(0);
  });

  it('skips months explicitly marked skipped', () => {
    const pending = computePendingGenerations({
      templates: [template],
      today: new Date(Date.UTC(2026, 7, 20)),
      existing: [],
      skips: [{ templateId: 't1', yearMonth: '2026-08' }],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(0);
  });

  it('ignores paused (inactive) templates', () => {
    const pending = computePendingGenerations({
      templates: [{ ...template, active: false }],
      today: new Date(Date.UTC(2026, 7, 20)),
      existing: [],
      skips: [],
      templateStartYearMonth: () => '2026-08',
    });
    expect(pending).toHaveLength(0);
  });
});

describe('computeVirtualOccurrences', () => {
  it('projects future months for active templates not yet generated', () => {
    const occurrences = computeVirtualOccurrences({
      templates: [
        { id: 't1', name: 'Seguro auto', dayOfMonth: 15, active: true, amountEstimate: 85000, categoryId: 'cat1' },
      ],
      fromYearMonth: '2026-08',
      monthsAhead: 3,
      existing: [],
    });
    expect(occurrences.map((o) => o.yearMonth)).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('excludes months that already have a real generated transaction', () => {
    const occurrences = computeVirtualOccurrences({
      templates: [
        { id: 't1', name: 'Seguro auto', dayOfMonth: 15, active: true, amountEstimate: 85000, categoryId: 'cat1' },
      ],
      fromYearMonth: '2026-08',
      monthsAhead: 2,
      existing: [{ templateId: 't1', yearMonth: '2026-08' }],
    });
    expect(occurrences.map((o) => o.yearMonth)).toEqual(['2026-09']);
  });
});
