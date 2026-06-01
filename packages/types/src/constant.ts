export const REDIS_KEYS = {
  engineCommands: "to_engine",
  engineEvents: "from_engine",
  responseQueue: (backend: string) => `Backend-${backend}`
}
