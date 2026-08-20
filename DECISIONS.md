# Decisions

Notes on the tradeoffs behind this codebase — what I chose, what I gave up, and why. Not a spec, just the reasoning.

## Single in-memory matching engine, no sharding

All order books, orders, positions, and balances live in one process's memory (`apps/engine`), mutated by a single writer reading commands off a Redis stream.

The goal was to get the *matching logic* right — netting, margin locks, liquidation, funding — and a single writer gives correctness for free: no distributed locks, no partial-write races between order-book and account state. Sharding by symbol or running multiple engine replicas is a real scaling path, just not this project's goal.

## From per-request queues to Redis Streams

The first version used plain Redis queues: the API pushed a command, kept a promise open per request, and resolved it when a matching reply landed on a reply queue.

That broke down once other services needed the *same* ordered history of engine events, not a point-to-point reply — `wss` needs to fan out every fill/update to connected clients, `db-poller` needs to persist every event. Redis Streams fixed this: consumer groups let the API, `wss`, and `db-poller` each read the same stream independently, replayably, at their own pace. Redis was already in the stack, so this was a usage change, not new infra.

## Integer cents / integer base units everywhere

Prices, balances, margins, funding — all integers outside the browser. The web app converts to/from dollars only at the render/input boundary.

Floating-point rounding errors compound silently across fills, netting, and funding settlement, and surface as balance discrepancies that are hard to trace back. Integers remove that whole bug class instead of managing it with a decimal library — and are cheaper in the hot matching path as a bonus.

## Price-feeder discovers markets instead of being told about them

`price-feeder` doesn't hardcode symbols. On boot it subscribes to the engine's event stream for `create_market` events *first*, then calls `get_markets` to backfill whatever markets already existed. The order matters: subscribing before backfilling means a market created in that gap still gets picked up, instead of falling through a race window. It then subscribes to Binance mark prices for the full set and forwards index-price updates back to the engine.

Result: adding a market never requires touching or restarting `price-feeder`.

## WSS as a cluster with pub/sub fan-out

`apps/wss` runs as a cluster in production (2 replicas on GKE; local docker-compose still runs a single instance): each server holds a subset of client connections. Reading engine events happens through a Redis consumer group, so each event is picked up by exactly one `wss` instance — that instance republishes it via Redis pub/sub, and every instance (including itself) delivers it to whichever local connections care.

This decouples "who received the event" from "who holds the relevant socket," which is what makes the WebSocket layer horizontally scalable without sticky sessions.

## Deterministic order/fill IDs derived from the stream entry ID

Order and fill IDs are derived from the Redis stream entry ID that carried the command (its timestamp component), not from `uuid()` or `Date.now()`.

This makes replay deterministic. If the engine crashes and reprocesses commands from the last snapshot, IDs generated at process-time would come out different on replay, breaking references (fills → orders, rows already written by `db-poller`). Deriving IDs from stream position means the same command always produces the same ID, first run or tenth.

The same property is what makes `db-poller`'s writes safe to reprocess: orders are upserted by that same deterministic ID, and fills are inserted with the write wrapped to swallow the unique-key error on a repeat ID rather than propagate it. Either way, a redelivered stream message — consumer-group crash, restart, rebalance, a claim reclaiming a message that's still being processed, anything that causes the same entry to be read (or read twice at once) — converges cleanly instead of erroring out and getting stuck retrying forever.

## Snapshot-to-R2 + stream-ID replay instead of writing every mutation to Postgres

The engine periodically serializes its full state (including the BTree order books) to Cloudflare R2, keeping the last 10 snapshots, along with the Redis stream ID it had processed up to. On restart it loads the snapshot and resumes the same single sequential `xRead` loop from that stream ID — there's no separate catch-up phase or gate, replayed and live commands just can't interleave because it's one loop reading one stream in order.

Persisting every mutation synchronously to Postgres would put a DB round-trip in the matching hot path. Snapshot + replay gives crash recovery without that cost; Postgres persistence (`db-poller`) happens asynchronously off the event stream for reporting and history, not as the recovery mechanism.

## Market-maker / degen bots as part of the system, not fixture data

`apps/market-maker` trades through the real public API/WS — the same paths a real user hits — instead of seeding fake DB rows.

An empty order book doesn't demo or feel real. Bots trading through the actual API make the exchange look live without real users, and exercise matching/margin/liquidation continuously instead of only in tests.

## Current known gaps

- Single-process engine — no horizontal scaling story yet.
- Liquidation math, insurance funds, bankruptcy prices, and ADL ranking are simplified, not production-grade.
- There are no fees anywhere in the system. Closing a position now correctly releases margin and settles realized PnL into the user's balance, but `realizedPnl` is pure `(exit - entry) * qty` — gross, not net of any fee.
- Money columns (`realizedPnl`, `marginReleased`, etc.) are `Int` cents, same convention as the rest of the schema, which caps them around $21.4M — flagged, not fixed.
- `apps/web` is an active work in progress, not a finished client.
- `db-poller` runs as a single replica (the ops repo pins it to `replicas: 1` specifically to remove cross-consumer event reordering — two readers on the same group can finish out-of-order DB writes for adjacent events, and since writes apply absolute snapshot values rather than deltas, a stale write landing after a newer one wouldn't self-correct). `wss` still runs 2 replicas on the pre-hardening consumer loop (30s claim interval, no same-message concurrency guard), so it can still double-publish or reorder pub/sub messages across replicas — lower stakes than a DB write since it's not persisted, but a live-book UI glitch, not yet fixed to match `db-poller`.
