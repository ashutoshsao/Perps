export function log(tag: string, message: string) {
  console.log(`[${new Date().toISOString()}] [${tag}] ${message}`);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function jitter(ms: number, spread = 0.3) {
  return ms * (1 - spread + Math.random() * 2 * spread);
}

export function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
