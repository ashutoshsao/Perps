import { createContext, useContext, useState, type ReactNode } from "react";

type TicketContextValue = {
  price: string;
  qty: string;
  setPrice: (v: string) => void;
  setQty: (v: string) => void;
};

const TicketContext = createContext<TicketContextValue | null>(null);

export function TicketProvider({ children }: { children: ReactNode }) {
  const [price, setPrice] = useState("64,427.2");
  const [qty, setQty] = useState("0.00000");

  return (
    <TicketContext.Provider value={{ price, qty, setPrice, setQty }}>
      {children}
    </TicketContext.Provider>
  );
}

export function useTicket() {
  const ctx = useContext(TicketContext);
  if (!ctx) throw new Error("useTicket must be used within TicketProvider");
  return ctx;
}
