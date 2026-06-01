import express from "express"
import { Env } from "./utils/config";
import { appRouter } from "./route";
const app = express();
app.use(express.json());

app.use("/api", appRouter);

app.listen(Env.PORT, () => {
  console.log(`backend started listening on port ${Env.PORT}`);
})
