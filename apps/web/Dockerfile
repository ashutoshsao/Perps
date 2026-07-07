FROM oven/bun:1

WORKDIR /app

COPY . .

ENV DATABASE_URL=postgresql://perps:perps@localhost:5432/perps

RUN bun install --frozen-lockfile
RUN cd packages/db && bunx prisma generate

CMD ["bun", "--filter", "web", "dev", "--host", "0.0.0.0"]
