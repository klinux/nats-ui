import { lagBarPercent, lagDotClass, lagLevel, lagTextClass } from '../../lib/lag';

interface LagCellProps {
  pending: number;
}

/**
 * Consumer lag as a shape, not just a number.
 *
 * Pending count alone forces the reader to compare figures across rows; the bar
 * makes a struggling consumer visible before any digit is read, and both the
 * fill and the figure take their colour from the same threshold.
 */
export function LagCell({ pending }: LagCellProps) {
  const level = lagLevel(pending);

  return (
    <div className="flex min-w-[9rem] items-center gap-2.5">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={pending}
        aria-valuemin={0}
        aria-label={`${pending.toLocaleString()} messages pending`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${lagDotClass(pending)}`}
          style={{ width: `${lagBarPercent(pending)}%` }}
        />
      </div>
      <span
        className={
          level === 'ok'
            ? 'w-16 text-right text-xs text-muted-foreground'
            : `w-16 text-right text-xs font-semibold ${lagTextClass(pending)}`
        }
      >
        {pending.toLocaleString()}
      </span>
    </div>
  );
}
