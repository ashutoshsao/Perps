export const REDIS_KEYS = {
  engineCommands: "to_engine",
  engineEvents: "from_engine",
  responseQueue: (backend: string) => `Backend-${backend}`,
  predictedFunding: (symbol: string) => `funding:${symbol}:predicted`,
}

// universal funding settlement times
export const FUNDING_TIMES_UTC_HOURS = [0, 8, 16];

export function nextFundingTime(now: Date = new Date()): number {
  const currentHour = now.getUTCHours()

  const nextHour = FUNDING_TIMES_UTC_HOURS.find(h => h > currentHour) ?? FUNDING_TIMES_UTC_HOURS[0];
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    nextHour, 0, 0, 0
  ))

  if (nextHour! <= currentHour) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime()
}
