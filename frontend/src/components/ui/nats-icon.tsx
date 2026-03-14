import { cn } from '@/lib/utils';

export function NatsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="nats-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="7" fill="url(#nats-bg)" />
      <rect x="7" y="8" width="3.5" height="16" rx="1.75" fill="white" />
      <rect x="21.5" y="8" width="3.5" height="16" rx="1.75" fill="white" />
      <path d="M8.75 9.5L23.25 22.5" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
