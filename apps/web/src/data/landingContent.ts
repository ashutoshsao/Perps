export const hero = {
  eyebrow: "NEBULA — PERPETUAL FUTURES",
  headline: "Trade price direction. Own nothing.",
  subhead:
    "Nebula is a perpetual futures exchange — go long or short on price with leverage, matched by a real order book, settled in real time.",
  primaryCta: { label: "Start trading", to: "/trade" },
  secondaryCta: { label: "How it works", to: "/about" },
};

export type TechnicalPoint = {
  stat: string;
  title: string;
  body: string;
};

// Pulled from this repo's own ARCHITECTURE.md / DECISIONS.md — real facts, not marketing copy.
export const technicalPoints: TechnicalPoint[] = [
  {
    stat: "int",
    title: "Integer-cent precision",
    body: "Every price, balance, and margin is an integer, end to end. Floats never enter the engine or the wire — no rounding drift, ever.",
  },
  {
    stat: "1x",
    title: "Single-writer matching engine",
    body: "One sequential order book, no sharding, no distributed race conditions. Every match is deterministic and reproducible.",
  },
  {
    stat: "id",
    title: "Deterministic replay",
    body: "Order and fill IDs are derived from stream position, not generated at process time — a crash and replay lands on the exact same state.",
  },
  {
    stat: "10",
    title: "Snapshot recovery",
    body: "Engine state snapshots to persistent storage on a cycle, keeping the last 10 — a restart resumes from exactly where it left off.",
  },
];

export const landingNavLinks = [
  { label: "About", to: "/about" },
  { label: "Trade", to: "/trade" },
];
