import type { LogLevel, LoggerConfig } from './types.js';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3, silent: 4,
};

const C = {
  debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m',
  error: '\x1b[31m', reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
};

export class Logger {
  private readonly level: number;
  private readonly prefix: string;

  constructor(config?: Partial<LoggerConfig>) {
    this.level = LOG_LEVELS[config?.level ?? 'info'];
    this.prefix = config?.prefix ?? 'nexomailer';
  }

  debug(msg: string, ctx?: Record<string, unknown>) { this.log('debug', msg, ctx); }
  info(msg: string, ctx?: Record<string, unknown>) { this.log('info', msg, ctx); }
  warn(msg: string, ctx?: Record<string, unknown>) { this.log('warn', msg, ctx); }
  error(msg: string, ctx?: Record<string, unknown>) { this.log('error', msg, ctx); }

  child(prefix: string): Logger {
    const lvl = Object.entries(LOG_LEVELS).find(([, v]) => v === this.level)?.[0] as LogLevel ?? 'info';
    return new Logger({ level: lvl, prefix: `${this.prefix}:${prefix}` });
  }

  private log(level: Exclude<LogLevel, 'silent'>, msg: string, ctx?: Record<string, unknown>) {
    if (LOG_LEVELS[level] < this.level) return;
    const ts = new Date().toISOString();
    const tag = level.toUpperCase().padEnd(5);
    let line = `${C.dim}${ts}${C.reset} ${C[level]}${C.bold}${tag}${C.reset} ${C.dim}[${this.prefix}]${C.reset} ${msg}`;
    if (ctx && Object.keys(ctx).length > 0) {
      line += ` ${C.dim}${JSON.stringify(ctx)}${C.reset}`;
    }
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}
