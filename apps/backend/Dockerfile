# Multi-stage build
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY apps/panel/package.json ./apps/panel/
COPY apps/marketing/package.json ./apps/marketing/
COPY desktop/package.json ./desktop/
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @senkronize/shared build
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build

FROM node:20-alpine AS runner
RUN apk add --no-cache wget
RUN addgroup -S senkronize && adduser -S senkronize -G senkronize
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/shared/dist ./node_modules/@senkronize/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@senkronize/shared/package.json
USER senkronize
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD wget -q --spider http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
