/**
 * Format bytes into human-readable string (B, KB, MB, GB, TB).
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Parse NATS uptime string (e.g. "2d3h5m10s") into total seconds.
 */
export function parseUptimeToSeconds(uptimeStr: string | number | undefined | null): number {
  if (!uptimeStr) return 0;
  const str = String(uptimeStr);

  let totalSeconds = 0;
  const dayMatch = str.match(/(\d+)d/);
  const hourMatch = str.match(/(\d+)h/);
  const minMatch = str.match(/(\d+)m/);
  const secMatch = str.match(/(\d+)s/);

  if (dayMatch?.[1]) totalSeconds += parseInt(dayMatch[1]) * 86400;
  if (hourMatch?.[1]) totalSeconds += parseInt(hourMatch[1]) * 3600;
  if (minMatch?.[1]) totalSeconds += parseInt(minMatch[1]) * 60;
  if (secMatch?.[1]) totalSeconds += parseInt(secMatch[1]);

  return totalSeconds;
}

/**
 * Format total seconds into human-readable uptime string.
 */
export function formatUptimeFromSeconds(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0s';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Format NATS uptime string directly into human-readable form.
 */
export function formatUptime(uptimeStr: string | number | undefined | null): string {
  return formatUptimeFromSeconds(parseUptimeToSeconds(uptimeStr));
}
