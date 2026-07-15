FROM oven/bun:1

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

CMD ["bun", "--filter", "web", "dev", "--host", "0.0.0.0"]
