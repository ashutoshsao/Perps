import { Router } from "express";
import { signin, signup } from "../controller/auth.controller";

export const authRouter: Router = Router();

authRouter.post("/signup", signup);

authRouter.post("/signin", signin);
