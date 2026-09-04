import { Router } from "express";
import { logout, refresh, signin, signup } from "../controller/auth.controller";

export const authRouter: Router = Router();

authRouter.post("/signup", signup);

authRouter.post("/signin", signin);

authRouter.post("/refresh", refresh);

authRouter.post("/logout", logout);
