import { Router } from "express";
import { verifyAuth } from "../helper/auth.middleware";
import { addBalance, cancelOrder, createMarket, createOrder } from "../controller/exchange.controller";
import { getMarkets } from "../handler/getMarkets";
import { getDepth } from "../handler/getDepth";
import { getKLines } from "../handler/getKLines";
import { getTicker } from "../handler/getTicker";
import { getTrades } from "../handler/getTrades";
import { getUserOrders } from "../handler/getUserOrders";
import { getUserFills } from "../handler/getUserFills";
import { getBalance } from "../handler/getBalance";

export const exchangeRouter: Router = Router();

// auth
exchangeRouter.post("/onramp", verifyAuth, addBalance);
exchangeRouter.post("/market", verifyAuth, createMarket);
exchangeRouter.post("/order", verifyAuth, createOrder);
exchangeRouter.delete("/order/:id", verifyAuth, cancelOrder);

// public
exchangeRouter.get("/markets", getMarkets);
exchangeRouter.get("/depth/:symbol", getDepth);
exchangeRouter.get("/klines/:symbol", getKLines);
exchangeRouter.get("/ticker/:symbol", getTicker);
exchangeRouter.get("/trades/:symbol", getTrades);

// authenticated
exchangeRouter.get("/orders", verifyAuth, getUserOrders);
exchangeRouter.get("/fills", verifyAuth, getUserFills);
exchangeRouter.get("/balance", verifyAuth, getBalance);
