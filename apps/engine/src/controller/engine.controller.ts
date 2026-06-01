import { EngineRequest } from "@repo/types";
import { createOrder } from "../handler/createOrder";
import { cancelOrder } from "../handler/cancelOrder";
import { updateIndexPrice } from "../handler/updateIndexPrice"
import { onramp } from "../handler/onramp";
import { fetchBalance } from "../handler/fetchBalance";
export function handleCommand(request: EngineRequest) {
  const { type, payload } = request;
  switch (type) {
    case "create_order":
      return createOrder(payload);
    case "cancel_order":
      return cancelOrder(payload);
    case "update_index_price":
      return updateIndexPrice(payload);
    case "onramp":
      return onramp(payload);
    case "get_balance":
      return fetchBalance(payload);
    case "get_depth":
      return getDepth(payload);
    case "create_market":
      return createMarket(payload);
    default: throw new Error("unknown command")
  }
}
