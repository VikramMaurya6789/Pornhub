# OrangeHub on Oracle Cloud Always Free (ARM VM)
# Multi-stage build. Built natively on the ARM VM — no cross-compile issues.
# Build context = repo root. Compose file lives in deploy/oracle/.

# ---------- deps ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time public URL (baked into client bundle). Passed via --build-arg.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npx prisma generate
# NOTE: `npm run build` also runs scripts/migrate.js, which warns and continues
# when no database is reachable at build time. The real migration runs at
# container startup (entrypoint.sh) against the compose Postgres service.
RUN npm run build

# ---------- runner ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
# openssl is required by Prisma engines on bookworm-slim
RUN apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY deploy/oracle/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
