import { Router } from "express";
import { authRouter } from "./auth.route";
import { exchangeRouter } from "./exchange.route";
export const appRouter: Router = Router();

appRouter.use(authRouter);
appRouter.use(exchangeRouter);
