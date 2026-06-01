import { Router } from "express";
import { verifyAuth } from "../helper/auth.middleware";
import { addBalance } from "../controller/exchange.controller";

export const exchangeRouter: Router = Router();

exchangeRouter.post("/onramp", verifyAuth, addBalance); 
