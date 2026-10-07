type Level = 'error' | 'warn' | 'info' | 'debug';
type PinoLike = Record<Level, (obj: object, msg: string) => void>;

/**
 * Logger do Better Auth sobre o pino. Só instâncias de Error são repassadas (no campo `err`,
 * que o pino serializa com stack e causa); outros argumentos podem conter dados do usuário e
 * são descartados.
 */
export function betterAuthLogger(log: PinoLike) {
  return {
    level: 'warn' as const,
    log: (level: Level, message: string, ...args: unknown[]) => {
      const err = args.find((a) => a instanceof Error);
      log[level]({ component: 'better-auth', ...(err ? { err } : {}) }, String(message));
    },
  };
}
