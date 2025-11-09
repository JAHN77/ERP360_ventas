/**
 * Sistema de logging centralizado
 * Reemplaza console.log para mejor control en producción
 */

const isDevelopment = import.meta.env.DEV;

type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'info';

interface LogOptions {
  level?: LogLevel;
  prefix?: string;
  condition?: boolean;
}

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (!isDevelopment && level === 'debug') return false;
    return true;
  }

  private formatMessage(prefix: string | undefined, message: string): string {
    return prefix ? `[${prefix}] ${message}` : message;
  }

  log(message: string, ...args: unknown[]): void;
  log(options: LogOptions, message: string, ...args: unknown[]): void;
  log(optionsOrMessage: LogOptions | string, ...args: unknown[]): void {
    if (typeof optionsOrMessage === 'string') {
      if (this.shouldLog('log')) {
        console.log(optionsOrMessage, ...args);
      }
    } else {
      const { level = 'log', prefix, condition = true } = optionsOrMessage;
      if (condition && this.shouldLog(level)) {
        const message = (args[0] as string) || '';
        const restArgs = args.slice(1);
        const formatted = this.formatMessage(prefix, message);
        console[level](formatted, ...restArgs);
      }
    }
  }

  warn(message: string, ...args: unknown[]): void;
  warn(options: LogOptions, message: string, ...args: unknown[]): void;
  warn(optionsOrMessage: LogOptions | string, ...args: unknown[]): void {
    if (typeof optionsOrMessage === 'string') {
      if (this.shouldLog('warn')) {
        console.warn(optionsOrMessage, ...args);
      }
    } else {
      const { prefix, condition = true } = optionsOrMessage;
      if (condition && this.shouldLog('warn')) {
        const message = (args[0] as string) || '';
        const restArgs = args.slice(1);
        const formatted = this.formatMessage(prefix, message);
        console.warn(formatted, ...restArgs);
      }
    }
  }

  error(message: string, ...args: unknown[]): void;
  error(options: LogOptions, message: string, ...args: unknown[]): void;
  error(optionsOrMessage: LogOptions | string, ...args: unknown[]): void {
    // Los errores siempre se muestran
    if (typeof optionsOrMessage === 'string') {
      console.error(optionsOrMessage, ...args);
    } else {
      const { prefix, condition = true } = optionsOrMessage;
      if (condition) {
        const message = (args[0] as string) || '';
        const restArgs = args.slice(1);
        const formatted = this.formatMessage(prefix, message);
        console.error(formatted, ...restArgs);
      }
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('log')) {
      console.info(message, ...args);
    }
  }
}

export const logger = new Logger();

