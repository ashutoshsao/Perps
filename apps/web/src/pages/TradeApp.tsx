import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopNav } from "../components/layout/TopNav";
import { MarketStrip } from "../components/layout/MarketStrip";
import { BottomPanel } from "../components/layout/BottomPanel";
import { FooterTicker } from "../components/layout/FooterTicker";
import { MobileLayout } from "../components/layout/MobileLayout";
import { ChartPanel } from "../features/chart/ChartPanel";
import { OrderBookPanel } from "../features/orderbook/OrderBookPanel";
import { OrderTicketPanel } from "../features/ticket/OrderTicketPanel";
import { useIsMobile } from "../hooks/useIsMobile";
import { useMarket } from "../context/MarketContext";

export function TradeApp() {
  const isMobile = useIsMobile();
  const { symbol: urlSymbol } = useParams<{ symbol?: string }>();
  const navigate = useNavigate();
  const { symbol, setSymbol } = useMarket();

  // adopt the symbol from a direct link (e.g. /trade/BTC_USD_PERP)
  useEffect(() => {
    if (urlSymbol && urlSymbol !== symbol) {
      setSymbol(urlSymbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSymbol]);

  // context -> URL: keep the address bar in sync so refresh/share/back-forward all work.
  useEffect(() => {
    if (symbol && symbol !== urlSymbol) {
      navigate(`/trade/${symbol}`, { replace: true });
    }
  }, [symbol, urlSymbol, navigate]);

  useEffect(() => {
    document.title = symbol ? `${symbol} · Nebula` : "Nebula";
  }, [symbol]);

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
