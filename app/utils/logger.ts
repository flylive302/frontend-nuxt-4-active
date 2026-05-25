/**
 * Production-safe Logger Utility
 *
 * Provides logging functions that only output in development mode.
 * Use this instead of direct console logging to prevent log spam in production.
 *
 * @example
 * import { logger } from '~/utils/logger';
 * logger.debug('[Module]', 'Debug message');
 * logger.info('[Module]', 'Info message');
 * logger.warn('[Module]', 'Warning message'); // Always logs
 * logger.error('[Module]', 'Error message');  // Always logs
 */

/**
 * Check if we're in development mode.
 * Uses import.meta.env for Vite compatibility.
 */
const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production';

/**
 * Create a prefixed log function for a specific module.
 * Useful for creating module-specific loggers.
 *
 * @param prefix - Module name prefix (e.g., '[Mediasoup]')
 * @returns Logger instance with prefix
 */
export function createLogger(prefix: string) {
  return {
    debug: (...args: unknown[]) => isDev && console.debug(prefix, ...args),
    info: (...args: unknown[]) => isDev && console.info(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

/**
 * Global logger instance.
 * Use for general logging or when a module prefix isn't needed.
 */
export const logger = {
  /**
   * Debug-level logging. Only outputs in development.
   * Use for verbose debugging information.
   */
  debug: (...args: unknown[]) => isDev && console.debug(...args),

  /**
   * Info-level logging. Only outputs in development.
   * Use for general information messages.
   */
  info: (...args: unknown[]) => isDev && console.info(...args),

  /**
   * Warning-level logging. Always outputs.
   * Use for non-critical issues that should be addressed.
   */
  warn: (...args: unknown[]) => console.warn(...args),

  /**
   * Error-level logging. Always outputs.
   * Use for errors and critical issues.
   */
  error: (...args: unknown[]) => console.error(...args),
};


