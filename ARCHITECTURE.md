# Nebula Architecture

This repo implements a centralized perpetual futures exchange. The backend is complete for the current version; the frontend in `apps/web` is now being built as the exchange client.

## Services

- `apps/engine`: Redis command consumer for markets, balances, matching, depth, positions, and funding triggers.
- `apps/api`: Express REST API under `/api` for auth, trading commands, account reads, and market data.
- `apps/db-poller`: consumes successful engine events and persists orders/fills to Postgres and raw fills to TimescaleDB.
- `apps/wss`: WebSocket gateway for market and user realtime channels.
- `apps/price-feeder`: subscribes to external mark-price feeds and forwards price updates.
- `apps/market-maker`: simulated participants (quoter, taker, liquidation-prone degen) that trade exclusively through the public API/wss so demo markets stay live; also seeds the demo markets on boot.
- `packages/db`: Prisma Postgres client plus Timescale helpers.
- `packages/types`: shared API schemas, engine payloads, market data, and event types.

## Deployment

`engine`, `api`, `wss`, `db-poller`, `price-feeder`, and `market-maker` all run as separate Deployments on GKE, in the `perps-app` namespace. `apps/web` deploys separately to Vercel — it's not part of the cluster. TimescaleDB and Redis are self-hosted in-cluster (StatefulSets + PVCs), not managed services. `ingress-nginx` + `cert-manager` route `api.nebula.ashutoshsao.com` / `ws.nebula.ashutoshsao.com` with real TLS. All manifests and secrets live in a separate `ops` repo — see that repo for the actual infra source of truth.

## Units

Money is integer cents everywhere outside the browser: order prices, index/mark prices, balances, margins, and funding payments. Quantities are integer base units of the asset. Floats never enter the engine or the wire — the web app converts cents to dollars only when rendering (`usd()` / `formatUsd()`) and dollars back to cents only when parsing user input (`parseUsdToCents()`).

## Frontend Stack

- React + TypeScript on Vite.
- Tailwind CSS v4 for layout and design tokens.
- TanStack Query for REST server state.
- Zustand for auth, selected market, orderbook, trades, and UI state.
- TradingView Lightweight Charts for candle charts.
- Raw browser `WebSocket` wrapper for backend channels.

## Product Direction

The frontend is a full centralized perpetual futures exchange, not a simple trading terminal. The experience should feel institutional, precise, and fast.

Design principles:

- Dense, calm market UI with no landing-page hero treatment.
- Dark graphite base, quiet panel structure, sharp grid discipline.
- Green and red are reserved for buy/sell and positive/negative market meaning.
- Typography prioritizes scan speed: tabular numbers, compact labels, clear hierarchy.
- One signature element: a market pulse rail for spread, mark/index movement, funding countdown, and connection health.
- Motion is functional: live row flashes, price ticks, focus states, and connection status only.
- Remove decoration that does not improve trading clarity.

## REST Contracts

All REST routes are served from `/api`.

Auth:

- `POST /signup`
- `POST /signin`

Trading and account:

- `POST /onramp`
- `POST /market`
- `POST /order`
- `DELETE /order/:id`
- `GET /orders`
- `GET /fills`
- `GET /balance`

Public market data:

- `GET /markets`
- `GET /depth/:symbol`
- `GET /klines/:symbol?interval=1m|5m|15m|1h|4h|1d&from=&to=&limit=`
- `GET /ticker/:symbol`
- `GET /trades/:symbol?limit=`

Authenticated routes require `Authorization: Bearer <token>`.

## WebSocket Contracts

Client subscription message:

```json
{ "type": "SUBSCRIBE", "channel": "market:BTC:depth" }
```

User channels require a token:

```json
{ "type": "SUBSCRIBE", "channel": "user:<userId>:orders", "token": "<jwt>" }
```

Channels:

- `market:{symbol}:depth`
- `market:{symbol}:trade`
- `user:{userId}:orders`
- `user:{userId}:fills`
- `user:{userId}:liquidations`

Server messages are JSON objects with `{ channel, data }`.

## Depth Sync Protocol

The frontend orderbook client must sync depth in this order:

1. Subscribe to `market:{symbol}:depth` first.
2. Buffer all incoming depth diffs.
3. Fetch `GET /depth/:symbol` for the HTTP snapshot.
4. Initialize the local orderbook from the snapshot.
5. Apply buffered diffs newer than the snapshot update id.
6. Apply future diffs directly.
7. Ignore stale or duplicate diffs.

Current backend depth responses expose bid/ask levels. If the snapshot does not expose `lastUpdateId`, add it before relying on strict Binance-style depth buffering.

## Frontend Build Order

1. Tailwind v4 setup.
2. App shell: exchange layout, routing, auth pages.
3. Market selector and global market header.
4. REST hooks: markets, ticker, depth, klines, trades, balance, orders, fills.
5. TradingView chart.
6. Orderbook with snapshot plus buffered WS diffs.
7. Order ticket for limit/market buy/sell with leverage, quantity, and slippage.
8. WebSocket live updates for market and user channels.
9. User panels: balance, open orders, order history, fills.
10. Polish pass: responsive layout, loading states, empty states, keyboard focus, reduced motion, and connection states.
