# Perps

Perps is a TypeScript/Bun playground for building the core of a perpetual futures exchange: an HTTP API at the edge, Redis Streams as the command bus, and a single in-memory matching engine that owns the trading state.

The project is not trying to hide behind a generic CRUD app. It is built around the uncomfortable parts of an exchange: price-time-ish matching, margin locks, position netting, liquidation checks, funding-rate hooks, snapshots, and the tension between fast in-memory state and durable coordination.

## Why This Exists

Most trading-app demos stop at "place an order" and store it in a database. That misses the interesting part.

An exchange engine has a different shape:

1. Requests should be validated at the edge.
2. Trading state should have one writer, otherwise order books become a race condition.
3. Commands need correlation IDs so APIs can wait for deterministic engine responses.
4. Markets need sorted books, not database scans.
5. Risk logic belongs close to the matching path, because positions, margin, liquidation, and fills all move together.

This repo explores that shape in a compact monorepo.

```txt
client
  |
  v
Express API
  |  validates auth + Zod payloads
  v
Redis Stream: to_engine
  |
  v
Engine process
  |  mutates in-memory books, orders, balances, positions
  v
Redis response stream / global event stream
  |
  v
API response
```

## The Core Idea

The API does not directly mutate the exchange.

For example, `POST /api/order` becomes a typed `create_order` command. The API writes it to Redis with a `correlationId` and a backend-specific response queue. The engine reads commands sequentially, executes the matching/risk logic, and writes the result back. That gives the project a simple but important property: the order book has a single authority.

Inside the engine, state currently lives in maps:

- `ORDERBOOKS`: per-symbol bid/ask trees using `sorted-btree`
- `ORDERS`: full order records and fills
- `POSITIONS`: per-user, per-symbol long/short exposure
- `BALANCES`: available and locked balances
- `MARKETS`: symbol configuration such as max leverage and min quantity
- `INDEX_PRICES`: mark/index prices used by liquidation checks

That choice is deliberate for a prototype. It keeps the hot path fast and easy to reason about, while snapshots provide a recovery story.

## What It Can Do

- User signup/signin with Argon2 password hashing and JWT auth
- Admin market creation with symbol, min quantity, and max leverage
- Balance onramp into a USD balance bucket
- Limit orders that rest on the book
- Market orders with slippage bounds
- Matching against best available liquidity
- Sorted depth snapshots for asks and bids
- Margin locking, refunding, and cancellation
- Position creation, increase, reduce, close, and flip
- Index-price updates that trigger liquidation checks
- Liquidation via market close order
- ADL fallback path when liquidation cannot find liquidity
- Funding-rate scheduler at 00:00, 08:00, and 16:00 UTC
- Engine snapshots with Redis stream ID recovery
- Integration tests for API flow and direct engine commands

## Monorepo Map

```txt
apps/
  api/           Express API, auth, request validation, Redis loopback
  engine/        Matching engine, risk logic, snapshots, command dispatcher
  price-feeder/  Binance mark-price feed for index prices and liquidation checks
  tests/         Bun tests covering API + engine behavior
  web/           Vite + React exchange UI

packages/
  db/            Prisma client and Postgres schema for users, markets, orders, fills
  redis/         Redis client factory
  types/         Shared Zod schemas, command types, Redis key constants
  ui/            Starter shared UI package
```

## Request Lifecycle

Creating an order travels through the system like this:

1. `apps/api/controller/exchange.controller.ts` validates the body with `CreateOrderApiSchema`.
2. `apps/api/service/loopBack.ts` writes a command to `REDIS_KEYS.engineCommands`.
3. `apps/engine/index.ts` blocks on the Redis stream and reads the next command.
4. `apps/engine/src/controller/engine.controller.ts` dispatches to `createOrder`.
5. `apps/engine/src/handler/createOrder.ts` checks market limits, locks margin, matches liquidity, updates fills and positions, and rests remaining limit quantity.
6. The engine writes the result to either a backend response queue or the global event stream.
7. The API resolves the original HTTP request using the correlation ID.

That loop is the heart of the repo.

## Tech Stack

- Bun workspaces
- TypeScript
- Express 5
- Redis Streams
- PostgreSQL / TimescaleDB
- Prisma
- Zod
- Argon2
- JWT
- sorted-btree
- Bun test
- Vite for the web shell

## Local Setup

Install dependencies:

```sh
bun install
```

The app is split across several cooperating processes. Before using the exchange flow, these backing services need to be available:

- Redis for command, response, and event streams
- TimescaleDB/Postgres for users, markets, orders, fills, and candle data
- `apps/engine` for the single-writer matching/risk loop
- `apps/api` for HTTP auth, trading, account, and market-data routes
- `apps/db-puller` to persist engine events into Postgres/TimescaleDB
- `apps/wss` for realtime market and user channels
- `apps/price-feeder` for external mark-price updates; index prices and liquidation checks depend on it

Create environment files for the services that need them. The project expects these variables:

```sh
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret
ADMIN_SECRET=dev-admin-secret
PORT_WSS=3030
```

The Redis package includes `packages/redis/example.env` as the minimal reference. The tests also look for env files in `packages/db/.env`, `packages/redis/.env`, `apps/engine/.env`, and `apps/api/.env`. The web app reads `apps/web/.env.example` for `VITE_API_URL` and `VITE_WS_URL`.

Run database migrations before starting the app services:

```sh
cd packages/db
bunx prisma migrate deploy
```

Run the core services in separate terminals:

```sh
bun --filter @repo/engine dev
bun --filter @repo/api dev
bun --filter @repo/db-puller dev
bun --filter @repo/wss dev
bun --filter @repo/price-feeder dev
```

Run the web app in another terminal if you want the browser client:

```sh
bun --filter web dev
```

Run tests:

```sh
bun --filter @repo/tests test
```

The integration tests require `DATABASE_URL` and `REDIS_URL` to point at running services.

## Docker Setup

Docker Compose is the easiest way to run the full local stack because the app needs Redis, TimescaleDB/Postgres, migrations, and multiple Bun services to be started with matching environment variables.

The Docker setup provides:

- `redis`
- `timescaledb`
- a one-shot migration service for `packages/db/prisma`
- `api`
- `engine`
- `db-puller`
- `wss`
- `web`
- `price-feeder`

Docker-specific environment variables live in `.env.docker`. Inside Docker, service-to-service URLs use container hostnames:

```sh
DATABASE_URL=postgresql://postgres:password@timescaledb:5432/perp
REDIS_URL=redis://redis:6379
```

Build and start the stack:

```sh
docker compose --env-file .env.docker up --build
```

Open the web app at `http://localhost:5173`. The API is exposed on `http://localhost:4000`, the websocket server on `ws://localhost:3030`, Redis on `localhost:6379`, and TimescaleDB/Postgres on `localhost:5432`.

Stop the stack:

```sh
docker compose down
```

Remove Docker-managed Redis, TimescaleDB, and engine snapshot data:

```sh
docker compose down -v
```

The app containers are built from service-specific Dockerfiles under `apps/*/Dockerfile`, and the migration container uses `packages/db/Dockerfile`. They are all based on the official `oven/bun` image because this repo runs TypeScript directly with Bun and uses `bun.lock`.

## Example Flow

Sign up:

```sh
curl -X POST http://localhost:4000/api/signup \
  -H 'content-type: application/json' \
  -d '{"username":"ada","password":"pass123","name":"Ada"}'
```

Create a market:

```sh
curl -X POST http://localhost:4000/api/market \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_JWT' \
  -H 'token: YOUR_ADMIN_SECRET' \
  -d '{"symbol":"BTC","imageUrl":"https://example.com/btc.png","maxLeverage":10,"minQty":1}'
```

Add USD balance:

```sh
curl -X POST http://localhost:4000/api/onramp \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_JWT' \
  -d '{"amount":100000}'
```

Place a limit order:

```sh
curl -X POST http://localhost:4000/api/order \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_JWT' \
  -d '{"orderType":"limit","side":"buy","price":100,"qty":10,"leverage":1,"symbol":"BTC"}'
```

Place a market order:

```sh
curl -X POST http://localhost:4000/api/order \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_JWT' \
  -d '{"orderType":"market","side":"buy","qty":4,"leverage":1,"slippageBps":100,"symbol":"BTC"}'
```

## Design Notes

The project keeps the exchange state in memory because the matching engine is the system of record for the hot path. PostgreSQL stores slower-moving application records such as users and market metadata, while Redis Streams provide ordering and a bridge between HTTP and the engine.

The order book uses `BTree<number, RestingOrder[]>` so asks can be traversed from low to high and bids from high to low. That makes depth and matching natural operations instead of query gymnastics.

Positions are netted per user and symbol. A fill on the same side increases size and recalculates average price. A fill on the opposite side reduces, closes, or flips the position. Liquidation price is modeled from average price and margin per quantity.

Snapshots serialize the engine maps, including BTree contents, to JSON files under `data/snapshots`. On restart, the engine loads the latest snapshot and resumes reading Redis from the saved stream ID.

## Current Rough Edges

This is a prototype, not a production exchange.

- The matching engine is single-process and in-memory.
- The database order/fill schema exists, but engine fills are not fully persisted back to Postgres yet.
- The price feeder currently logs Binance mark prices rather than publishing `update_index_price` commands into Redis.
- The web app (`apps/web`) is a fresh Vite + React scaffold, still under active development.
- Some exchange mechanics are simplified: liquidation math, insurance funds, fees, realized PnL, bankruptcy prices, and full ADL ranking are not production-grade.
- There are a few implementation rough edges visible in the current code, such as the cancel endpoint dispatching the wrong command type and funding scheduling using a typo in the response queue field. These are useful next cleanup targets.

## What To Read First

If you are reviewing the repo, start here:

- `apps/engine/src/handler/createOrder.ts` for matching, margin locks, fills, and position updates
- `apps/engine/src/helper/matchOrder.ts` for book traversal
- `apps/engine/src/helper/updatePosition.ts` for position netting
- `apps/api/service/loopBack.ts` for Redis command/response correlation
- `apps/tests/index.test.ts` for the intended behavior

The interesting part is not the endpoint list. It is the boundary between an ordinary web API and a stateful exchange engine, and how much simpler the system becomes once that boundary is explicit.
