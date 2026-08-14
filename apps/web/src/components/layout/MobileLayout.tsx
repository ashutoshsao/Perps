import { useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileMarketStrip } from "./MobileMarketStrip";
import { MobileMarketsBrowser } from "./MobileMarketsBrowser";
import { BottomPanel } from "./BottomPanel";
import { ChartPanel } from "../../features/chart/ChartPanel";
import { OrderBookPanel } from "../../features/orderbook/OrderBookPanel";
import { OrderTicketPanel } from "../../features/ticket/OrderTicketPanel";

const SUB_TABS = ["Chart", "Order Book", "Trades", "More"] as const;
type SubTab = (typeof SUB_TABS)[number];

const NAV_TABS = ["Markets", "Account", "Trade"] as const;
type Nav = (typeof NAV_TABS)[number];

export function MobileLayout() {
  const [subTab, setSubTab] = useState<SubTab>("Chart");
  const [nav, setNav] = useState<Nav>("Trade");

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <MobileHeader />
      <MobileMarketStrip />

      {nav === "Markets" ? (
        <MobileMarketsBrowser onSelect={() => setNav("Trade")} />
      ) : nav === "Account" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
          <div className="flex min-w-[600px] flex-1">
            <BottomPanel variant="mobile" />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex h-10 shrink-0 items-center gap-5 border-b border-border-soft px-3">
            {SUB_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSubTab(t)}
                className={`whitespace-nowrap text-[13px] font-medium ${
                  subTab === t ? "text-text" : "text-text-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex h-[360px] w-full shrink-0 flex-col">
            {subTab === "Chart" && <ChartPanel />}
            {subTab === "Order Book" && <OrderBookPanel variant="mobile" hideTabs tab="Book" />}
            {subTab === "Trades" && <OrderBookPanel variant="mobile" hideTabs tab="Trades" />}
            {subTab === "More" && <MobileMoreStats />}
          </div>

          <div className="border-t border-border-soft">
            <OrderTicketPanel variant="mobile" />
          </div>
        </div>
      )}

      <div className="flex h-12 shrink-0 items-center border-t border-border-soft bg-panel">
        {NAV_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setNav(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 text-[13px] font-medium ${
              nav === t ? (t === "Trade" ? "text-green" : "text-text") : "text-text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function MobileMoreStats() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-text-dim">
      Tap the price in the market strip above for index price, funding, and 24H stats.
    </div>
  );
}
