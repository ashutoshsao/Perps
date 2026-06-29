-- enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- raw fills hypertable for candle generation
CREATE TABLE fills_ts (
  time    TIMESTAMPTZ NOT NULL,
  symbol  TEXT        NOT NULL,
  price   BIGINT      NOT NULL,
  qty     BIGINT      NOT NULL,
  side    TEXT        NOT NULL
);

SELECT create_hypertable('fills_ts', 'time', if_not_exists => TRUE);

-- 1m continuous aggregate
CREATE MATERIALIZED VIEW candles_1m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  symbol,
  first(price, time) AS open,
  max(price)         AS high,
  min(price)         AS low,
  last(price, time)  AS close,
  sum(qty)           AS volume
FROM fills_ts
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1m',
  start_offset      => INTERVAL '1 hour',
  end_offset        => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);

-- 5m continuous aggregate from 1m
CREATE MATERIALIZED VIEW candles_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', bucket) AS bucket,
  symbol,
  first(open,   bucket) AS open,
  max(high)             AS high,
  min(low)              AS low,
  last(close,   bucket) AS close,
  sum(volume)           AS volume
FROM candles_1m
GROUP BY time_bucket('5 minutes', bucket), symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_5m',
  start_offset      => INTERVAL '5 hours',
  end_offset        => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes'
);

-- 15m continuous aggregate from 5m
CREATE MATERIALIZED VIEW candles_15m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', bucket) AS bucket,
  symbol,
  first(open,   bucket) AS open,
  max(high)             AS high,
  min(low)              AS low,
  last(close,   bucket) AS close,
  sum(volume)           AS volume
FROM candles_5m
GROUP BY time_bucket('15 minutes', bucket), symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_15m',
  start_offset      => INTERVAL '15 hours',
  end_offset        => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes'
);

-- 1h continuous aggregate from 15m
CREATE MATERIALIZED VIEW candles_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', bucket) AS bucket,
  symbol,
  first(open,   bucket) AS open,
  max(high)             AS high,
  min(low)              AS low,
  last(close,   bucket) AS close,
  sum(volume)           AS volume
FROM candles_15m
GROUP BY time_bucket('1 hour', bucket), symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1h',
  start_offset      => INTERVAL '24 hours',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

-- 4h continuous aggregate from 1h
CREATE MATERIALIZED VIEW candles_4h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('4 hours', bucket) AS bucket,
  symbol,
  first(open,   bucket) AS open,
  max(high)             AS high,
  min(low)              AS low,
  last(close,   bucket) AS close,
  sum(volume)           AS volume
FROM candles_1h
GROUP BY time_bucket('4 hours', bucket), symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_4h',
  start_offset      => INTERVAL '2 days',
  end_offset        => INTERVAL '4 hours',
  schedule_interval => INTERVAL '4 hours'
);

-- 1d continuous aggregate from 4h
CREATE MATERIALIZED VIEW candles_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', bucket) AS bucket,
  symbol,
  first(open,   bucket) AS open,
  max(high)             AS high,
  min(low)              AS low,
  last(close,   bucket) AS close,
  sum(volume)           AS volume
FROM candles_4h
GROUP BY time_bucket('1 day', bucket), symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1d',
  start_offset      => INTERVAL '7 days',
  end_offset        => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);
