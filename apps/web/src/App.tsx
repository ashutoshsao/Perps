import "./index.css";

import { TopNav } from "./components/layout/TopNav";
import { MarketStrip } from "./components/layout/MarketStrip";
import { BottomPanel } from "./components/layout/BottomPanel";
import { FooterTicker } from "./components/layout/FooterTicker";
import { MobileLayout } from "./components/layout/MobileLayout";
import { ChartPanel } from "./features/chart/ChartPanel";
import { OrderBookPanel } from "./features/orderbook/OrderBookPanel";
import { OrderTicketPanel } from "./features/ticket/OrderTicketPanel";
import { AuthModal } from "./components/auth/AuthModal";
import { NotificationListener } from "./components/notifications/NotificationListener";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { MarketProvider } from "./context/MarketContext";
import { TradingProvider } from "./context/TradingContext";
import { OrdersProvider } from "./context/OrdersContext";
import { TicketProvider } from "./context/TicketContext";
import { useIsMobile } from "./hooks/useIsMobile";

export function App() {
  const isMobile = useIsMobile();

  return (
    <ToastProvider>
      <AuthProvider>
        <MarketProvider>
          <TradingProvider>
            <OrdersProvider>
              <TicketProvider>
                {isMobile ? (
                  <MobileLayout />
                ) : (
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
                )}
                <AuthModal />
                <NotificationListener />
              </TicketProvider>
            </OrdersProvider>
          </TradingProvider>
        </MarketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
