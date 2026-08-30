/**
 * Consumer lag classification.
 *
 * The same thresholds used to be written three times — the dot colour in
 * Consumers, the colour and label in ConsumerDetail, and the toast triggers —
 * and only the toasts knew about the critical threshold at all. Everything that
 * colours, labels or warns about lag reads from here.
 */
export type LagLevel = 'ok' | 'warn' | 'crit';

/** Pending messages at which a consumer is considered to be falling behind. */
export const LAG_WARN = 1_000;

/** Pending messages at which a consumer needs attention now. */
export const LAG_CRIT = 10_000;

export function lagLevel(pending: number): LagLevel {
  // Absent or nonsensical counts must not read as an emergency.
  if (!Number.isFinite(pending) || pending < LAG_WARN) return 'ok';
  return pending >= LAG_CRIT ? 'crit' : 'warn';
}

const LABELS: Record<LagLevel, string> = {
  ok: 'Healthy',
  warn: 'Behind',
  crit: 'Critical',
};

export function lagLabel(pending: number): string {
  return LABELS[lagLevel(pending)];
}

/*
 * These maps hold complete class names on purpose. Tailwind scans source text
 * for literal classes, so an interpolated `bg-state-${level}` is never
 * generated — the colour only appeared at all because the same literals happen
 * to exist in other components, and `border-l-state-*`, which appears nowhere
 * else, silently rendered no stripe.
 */
const DOT_CLASSES: Record<LagLevel, string> = {
  ok: 'bg-state-ok',
  warn: 'bg-state-warn',
  crit: 'bg-state-crit',
};

const TEXT_CLASSES: Record<LagLevel, string> = {
  ok: 'text-state-ok',
  warn: 'text-state-warn',
  crit: 'text-state-crit',
};

/*
 * The stripe is an inset shadow on the row's first cell rather than a border on
 * the row: with border-collapse, the table resolves adjacent borders against
 * each other and dropped the last row's stripe entirely.
 */
const BORDER_CLASSES: Record<LagLevel, string> = {
  ok: 'shadow-[inset_2px_0_0_var(--state-ok)]',
  warn: 'shadow-[inset_2px_0_0_var(--state-warn)]',
  crit: 'shadow-[inset_2px_0_0_var(--state-crit)]',
};

export function lagDotClass(pending: number): string {
  return DOT_CLASSES[lagLevel(pending)];
}

export function lagTextClass(pending: number): string {
  return TEXT_CLASSES[lagLevel(pending)];
}

/** Badge variant for the lag level, for shadcn's Badge component. */
export function lagBadgeVariant(pending: number): 'default' | 'secondary' | 'destructive' {
  const level = lagLevel(pending);
  if (level === 'crit') return 'destructive';
  return level === 'warn' ? 'default' : 'secondary';
}

/**
 * How full the lag bar should be, as a percentage.
 *
 * Deliberately not a raw ratio: lag spans zero to millions, so a linear scale
 * would leave every healthy consumer at an indistinguishable sliver. Each
 * threshold owns a third of the bar, which makes "a third full" mean *behind*
 * and "two thirds" mean *critical* at a glance.
 */
export function lagBarPercent(pending: number): number {
  if (!Number.isFinite(pending) || pending <= 0) return 0;
  if (pending < LAG_WARN) return (pending / LAG_WARN) * 33;
  if (pending < LAG_CRIT) return 33 + ((pending - LAG_WARN) / (LAG_CRIT - LAG_WARN)) * 33;
  // Past critical the bar saturates; the number carries the magnitude.
  return Math.min(100, 66 + (pending / LAG_CRIT - 1) * 34);
}

/** Class for the state stripe drawn on a consumer row. */
export function lagStripeClass(pending: number): string {
  return BORDER_CLASSES[lagLevel(pending)];
}
