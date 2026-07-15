export const market = {
  symbol: "BTC-PERP",
  leverage: "75x",
  lastPrice: "64,439.0",
  indexPrice: "64,441.9",
  change24hAbs: "+2,218.4",
  change24hPct: "+3.57%",
  fundingRate: "0.0013%",
  fundingCountdown: "00:41:01",
  high24h: "64,932.7",
  low24h: "61,786.3",
  volume24h: "89,428,579.77",
  openInterest: "443.49842",
};

export const orderBook = {
  asks: [
    { price: "64,440.0", size: "0.00010", total: "3.35903", depth: 92 },
    { price: "64,439.4", size: "0.03979", total: "3.35893", depth: 90 },
    { price: "64,439.2", size: "0.01163", total: "3.31914", depth: 87 },
    { price: "64,439.1", size: "0.01163", total: "3.30751", depth: 85 },
    { price: "64,439.0", size: "0.01163", total: "3.29588", depth: 83 },
    { price: "64,438.9", size: "0.01163", total: "3.28425", depth: 81 },
    { price: "64,438.8", size: "3.27262", total: "3.27262", depth: 78 },
  ],
  bids: [
    { price: "64,438.7", size: "0.00047", total: "0.00047", depth: 4 },
    { price: "64,429.7", size: "0.07759", total: "0.07806", depth: 8 },
    { price: "64,429.0", size: "0.07759", total: "0.15565", depth: 14 },
    { price: "64,427.1", size: "0.00079", total: "0.15644", depth: 15 },
    { price: "64,425.6", size: "0.00009", total: "0.15653", depth: 16 },
    { price: "64,425.5", size: "0.23903", total: "0.39556", depth: 32 },
    { price: "64,424.9", size: "0.01552", total: "0.41108", depth: 34 },
  ],
  bestBid: "64,439.0",
  bestAsk: "64,441.9",
  buyRatio: 14,
  sellRatio: 86,
};

export const recentTrades = [
  { price: "64,439.0", size: "0.00821", side: "buy" as const, time: "17:18:57" },
  { price: "64,438.9", size: "0.01204", side: "sell" as const, time: "17:18:55" },
  { price: "64,439.4", size: "0.00047", side: "buy" as const, time: "17:18:52" },
  { price: "64,438.7", size: "0.03310", side: "sell" as const, time: "17:18:49" },
  { price: "64,440.0", size: "0.00092", side: "buy" as const, time: "17:18:47" },
  { price: "64,438.9", size: "0.00518", side: "sell" as const, time: "17:18:44" },
  { price: "64,439.1", size: "0.01163", side: "buy" as const, time: "17:18:41" },
  { price: "64,438.8", size: "0.07204", side: "sell" as const, time: "17:18:38" },
  { price: "64,439.2", size: "0.00163", side: "buy" as const, time: "17:18:35" },
  { price: "64,438.7", size: "0.00047", side: "sell" as const, time: "17:18:32" },
];

export const navLinks = ["Spot", "Futures", "Lend", "Vault", "Stocks", "BP"];

export const chartTabs = ["Chart", "Depth", "Margin", "Funding", "Market Info"];

export const bottomTabs = [
  "Balances",
  "Positions",
  "Open Orders",
  "Borrows",
  "TWAP",
  "Fill History",
  "Order History",
  "Position His",
];
