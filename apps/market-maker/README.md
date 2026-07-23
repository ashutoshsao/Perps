# market-maker

Simulated market participants for the demo deployment. The matching engine, orderbook, funding, and liquidations are all real — this service just supplies the participants, exclusively through the public API and websocket gateway (no privileged engine access).

## Bots

- **nebula-mm (quoter)** — keeps a two-sided ladder of limit orders anchored to the live external index price from `price-feeder`. Requotes when the index drifts or the book goes stale.
- **flow-desk (taker)** — sends randomly timed and sized market orders that cross the spread, so the trade tape, candles, and 24h stats come from genuine matches.
- **leverage-larry (degen)** — periodically opens max-leverage positions and lets the market decide: liquidation (exercising the liquidation engine + notifications channel) or a later close.

On startup the service also seeds the demo markets (BTC-PERP, ETH-PERP, SOL-PERP) through `POST /market` if they don't exist yet.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `MM_API_URL` | `http://localhost:4000/api` | REST API base |
| `MM_WS_URL` | `ws://localhost:3030` | websocket gateway |
| `ADMIN_SECRET` | — | required to seed markets |
| `MM_BOT_PASSWORD` | `nebula-bots-dev` | password for the bot accounts |
| `MM_QUOTER` | `true` | set `false` to disable the liquidity ladder |
| `MM_TAKER` | `true` | set `false` to disable random order flow |
| `MM_DEGEN` | `true` | set `false` to disable the liquidation bot |

## Turning the simulation off

Everything synthetic lives in this one service, so `docker compose stop market-maker` is the single off switch — on SIGTERM the service cancels its resting quotes so the book doesn't show stale liquidity. Restarting it re-seeds and resumes. Use the `MM_*` toggles above for per-bot control.

## Run

```sh
bun run dev
```

All money values on the wire are integer cents; quantities are integer base units.
