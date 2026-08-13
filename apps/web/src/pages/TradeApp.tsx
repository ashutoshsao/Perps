import { useEffect } from "react";
import { TopNav } from "../components/layout/TopNav";
import { MarketStrip } from "../components/layout/MarketStrip";
import { BottomPanel } from "../components/layout/BottomPanel";
import { FooterTicker } from "../components/layout/FooterTicker";
import { MobileLayout } from "../components/layout/MobileLayout";
import { ChartPanel } from "../features/chart/ChartPanel";
import { OrderBookPanel } from "../features/orderbook/OrderBookPanel";
import { OrderTicketPanel } from "../features/ticket/OrderTicketPanel";
import { useIsMobile } from "../hooks/useIsMobile";

export function TradeApp() {
  const isMobile = useIsMobile();

  useEffect(() => {
    document.title = "BTC-PERP · Nebula";
  }, []);

  if (isMobile) {
    return <MobileLayout />;
  }

  return (
    <div className="flex h-screen min-w-[1200px] flex-col bg-bg text-text">
      <TopNav />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <MarketStrip />
          <div className="flex min-h-0 flex-1">
            <ChartPanel />
            <OrderBookPanel />
          </div>
          <BottomPanel />
        </div>
        <OrderTicketPanel />
      </div>

      <FooterTicker />
    </div>
  );
}
