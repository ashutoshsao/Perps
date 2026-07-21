import { createOrder } from "../handler/createOrder";
import { cancelOrder } from "../handler/cancelOrder";
import { updateIndexPrice } from "../handler/updateIndexPrice"
import { addBalance } from "../handler/addBalance";
import { getBalance } from "../handler/getBalance";
import { addBalancePayload, cancelOrderPayload, CreateMarketPayload, createOrderPayload, EngineRequest, getBalancePayload, GetDepthPayload, updateIndexPricePayload } from "@repo/types";
import { createMarket } from "../handler/createMarket";
import { getDepth } from "../handler/getDepth";
import { fundingRate } from "../handler/fundingRate";
import { getMarkets } from "../handler/getMarkets";

export function handleCommand(request: EngineRequest) {
  const { type, payload, streamMsgId } = request;
  switch (type) {
    case "create_order":
      return createOrder(payload as createOrderPayload, streamMsgId);
    case "cancel_order":
      return cancelOrder(payload as cancelOrderPayload);
    case "create_market":
      return createMarket(payload as CreateMarketPayload);
    case "update_index_price":
      return updateIndexPrice(payload as updateIndexPricePayload, streamMsgId);
    case "add_balance":
      return addBalance(payload as addBalancePayload);
    case "get_balance":
      return getBalance(payload as getBalancePayload);
    case "get_depth":
      return getDepth(payload as GetDepthPayload);
    case "funding_rate":
      return fundingRate(streamMsgId);
    case "get_markets":
      return getMarkets();
    default: throw new Error("unknown command")
  }
}
