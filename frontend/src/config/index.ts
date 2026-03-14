/**
 * Application configuration
 */
export const config = {
  app: {
    // Application title displayed in browser tab
    title: 'NATS UI',

    // Maximum number of messages to keep in memory
    maxMessages: 1000,

    // Refresh interval for monitoring data (milliseconds)
    monitoringRefreshInterval: 5000,
  },
} as const;

export type Config = typeof config;
