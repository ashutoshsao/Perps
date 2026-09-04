
function getEnv(envName: string): string {
  const env = process.env[envName];
  if (!env) throw new Error(`backend env ${envName} not present`);
  return env;
}

export const Env = {
  PORT: parseInt(getEnv("PORT")),
  DATABASE_URL: getEnv("DATABASE_URL"),
  REDIS_URL: getEnv("REDIS_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  ADMIN_SECRET: getEnv("ADMIN_SECRET"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL_DAYS: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? "30"),
}
