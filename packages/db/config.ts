
function getEnv(envName: string): string {
  const env = process.env[envName];
  if (!env) throw new Error(`db env ${envName} not present`);
  return env;
}

export const Env = {
  PORT: parseInt(getEnv("PORT")),
  DATABASE_URL: getEnv("DATABASE_URL")
}
