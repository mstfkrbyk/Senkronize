FROM node:20-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY desktop/package.json ./desktop/
RUN pnpm install --frozen-lockfile --filter backend... --filter @senkronize/shared

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend
RUN pnpm --filter @senkronize/shared build
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build

FROM builder AS deployprep
WORKDIR /app
RUN pnpm --filter backend deploy --prod /deploy/app
WORKDIR /deploy/app
RUN ./node_modules/.bin/prisma generate

FROM base AS runner
WORKDIR /deploy/app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs
COPY --from=deployprep --chown=nestjs:nodejs /deploy/app ./
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
