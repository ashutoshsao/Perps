
function getEnv(envName: string) {
  const env = process.env[envName];
  if (!env) throw new Error(`backend env ${envName} not present`);
  return env;
}

export const Env = {
  PORT_WSS: parseInt(getEnv("PORT_WSS")),
  // PORT: parseInt(getEnv("PORT")),
  // DATABASE_URL: getEnv("DATABASE_URL"),
  REDIS_URL: getEnv("REDIS_URL"),
  JWT_SECRET: getEnv("JWT_SECRET")
}
