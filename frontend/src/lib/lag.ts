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

export function lagDotClass(pending: number): string {
  return `bg-state-${lagLevel(pending)}`;
}

export function lagTextClass(pending: number): string {
  return `text-state-${lagLevel(pending)}`;
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

export function lagBorderClass(pending: number): string {
  return `border-l-state-${lagLevel(pending)}`;
}
