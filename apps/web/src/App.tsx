import "./index.css";

import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { AboutPage } from "./pages/AboutPage";
import { TradeApp } from "./pages/TradeApp";
import { AuthModal } from "./components/auth/AuthModal";
import { NotificationListener } from "./components/notifications/NotificationListener";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { MarketProvider } from "./context/MarketContext";
import { TradingProvider } from "./context/TradingContext";
import { OrdersProvider } from "./context/OrdersContext";
import { TicketProvider } from "./context/TicketContext";

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MarketProvider>
          <TradingProvider>
            <OrdersProvider>
              <TicketProvider>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/trade" element={<TradeApp />} />
                </Routes>
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
