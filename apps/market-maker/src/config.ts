export const Env = {
  apiUrl: process.env.MM_API_URL ?? "http://localhost:4000/api",
  wsUrl: process.env.MM_WS_URL ?? "ws://localhost:3030",
  adminSecret: process.env.ADMIN_SECRET ?? "",
  botPassword: process.env.MM_BOT_PASSWORD ?? "nebula-bots-dev",
  quoterEnabled: (process.env.MM_QUOTER ?? "true").toLowerCase() !== "false",
  takerEnabled: (process.env.MM_TAKER ?? "true").toLowerCase() !== "false",
  degenEnabled: (process.env.MM_DEGEN ?? "true").toLowerCase() !== "false",
};

export type MarketSpec = {
  symbol: string;
  imageUrl: string;
  maxLeverage: number;
  minQty: number;
  /** quote levels per side */
  levels: number;
  /** half-spread at the touch, in basis points of the index price */
  spreadBps: number;
  /** spacing between levels, in basis points */
  stepBps: number;
  /** min/max size per quoted level, in base units */
  quoteSize: [number, number];
  /** min/max size of taker orders, in base units */
  takerSize: [number, number];
};

const ICONS = "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color";

export const MARKET_SPECS: MarketSpec[] = [
  {
    symbol: "BTC-PERP",
    imageUrl: `${ICONS}/btc.png`,
    maxLeverage: 50,
    minQty: 1,
    levels: 7,
    spreadBps: 1,
    stepBps: 2,
    quoteSize: [1, 3],
    takerSize: [1, 2],
  },
  {
    symbol: "ETH-PERP",
    imageUrl: `${ICONS}/eth.png`,
    maxLeverage: 50,
    minQty: 1,
    levels: 7,
    spreadBps: 2,
    stepBps: 3,
    quoteSize: [2, 10],
    takerSize: [1, 6],
  },
  {
    symbol: "SOL-PERP",
    // trustwallet has correct SOL branding and isn't ad-blocked like coinmarketcap
    imageUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
    maxLeverage: 20,
    minQty: 1,
    levels: 6,
    spreadBps: 3,
    stepBps: 5,
    quoteSize: [10, 80],
    takerSize: [2, 40],
  },
];
