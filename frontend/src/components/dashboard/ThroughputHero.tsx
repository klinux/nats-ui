import { Card } from '../ui/card';
import { sparklinePath } from '../../lib/series';

interface ThroughputHeroProps {
  /** Messages per second, derived from consecutive polls. */
  rate: number;
  /** Recent rate samples, oldest first. */
  history: number[];
  /** Cumulative messages processed. */
  total: number;
}

const WIDTH = 340;
const HEIGHT = 56;

function formatRate(rate: number): string {
  if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(1)}M`;
  if (rate >= 1_000) return `${(rate / 1_000).toFixed(1)}k`;
  return rate.toFixed(rate < 10 ? 1 : 0);
}

/**
 * The dashboard's lead number.
 *
 * Four identical metric cards implied that uptime matters as much as
 * throughput. Throughput is what people open this page for, so it gets the
 * size, the trend line and the only animation on the page.
 */
export function ThroughputHero({ rate, history, total }: ThroughputHeroProps) {
  const path = sparklinePath(history, WIDTH, HEIGHT);

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Throughput
        </span>
        <div className="flex items-baseline gap-2">
          <span className="tabular text-4xl font-bold leading-none tracking-tight transition-all duration-500">
            {formatRate(rate)}
          </span>
          <span className="text-sm text-muted-foreground">msgs/s</span>
        </div>
        <span className="tabular text-xs text-muted-foreground">
          {total.toLocaleString()} processed since start
        </span>
      </div>

      {path ? (
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          fill="none"
          className="max-w-full shrink-0"
          role="img"
          aria-label={`Throughput over the last ${history.length} samples`}
        >
          <defs>
            <linearGradient id="throughput-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity="0.35" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`} fill="url(#throughput-fill)" />
          <path d={path} stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="text-xs text-muted-foreground">Collecting samples…</span>
      )}
    </Card>
  );
}
