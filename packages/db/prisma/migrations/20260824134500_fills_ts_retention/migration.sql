-- daily chunks let drop_chunks reclaim space incrementally (default is 7 days)
SELECT set_chunk_time_interval('fills_ts', INTERVAL '1 day');

-- only candles_1m reads raw fills_ts (1h lookback in its refresh policy); every
-- other interval cascades from candles_1m/5m/etc, so compressing/dropping raw
-- ticks never touches already-materialized aggregate data.
ALTER TABLE fills_ts SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('fills_ts', INTERVAL '12 hours');

-- no add_retention_policy here: raw ticks are archived to R2 before being
-- dropped, via the timescale-archive CronJob (ops repo), not blind-dropped.
