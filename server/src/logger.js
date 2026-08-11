/** Tiny leveled logger. No dependency, structured enough to grep. */
import { config } from './config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

const threshold = () => LEVELS[config.logLevel] ?? LEVELS.info;

function emit(level, stream, args) {
  if (LEVELS[level] < threshold()) return;
  const stamp = new Date().toISOString();
  stream(`[${stamp}] ${level.toUpperCase().padEnd(5)}`, ...args);
}

export const logger = {
  debug: (...args) => emit('debug', console.log, args),
  info: (...args) => emit('info', console.log, args),
  warn: (...args) => emit('warn', console.warn, args),
  error: (...args) => emit('error', console.error, args),
  /** Logs how long `fn` took, then returns its result. */
  async time(label, fn) {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      emit('debug', console.log, [`${label} took ${Date.now() - started}ms`]);
    }
  },
};

export default logger;
