// How long a one-time payment keeps the membership active.

export const ONE_TIME_COVERAGE_DAYS = 30;

const DAY_MS = 86_400_000;

export interface Coverage {
  readonly coversFrom: Date;
  readonly coversUntil: Date;
}

/**
 * New coverage starts when the current paid coverage ends (or now, if there is none), so renewing
 * early never wastes days that were already paid for.
 */
export function computeCoverage(now: Date, latestCoversUntil: Date | null): Coverage {
  const startMs =
    latestCoversUntil && latestCoversUntil.getTime() > now.getTime() ? latestCoversUntil.getTime() : now.getTime();
  return {
    coversFrom: new Date(startMs),
    coversUntil: new Date(startMs + ONE_TIME_COVERAGE_DAYS * DAY_MS),
  };
}
