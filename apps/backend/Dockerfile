FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Tüm workspace bağımlılıkları (derleme için)
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY desktop/package.json ./desktop/
RUN pnpm install --frozen-lockfile

FROM deps AS shared-build
COPY packages/shared ./packages/shared
RUN pnpm --filter @senkronize/shared build

FROM shared-build AS backend-build
COPY apps/backend ./apps/backend
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build

# Üretim node_modules + dist: yalnızca prod bağımlılıkları
FROM backend-build AS deploy
WORKDIR /app
RUN pnpm --filter backend deploy --prod /deploy/app
WORKDIR /deploy/app
RUN ./node_modules/.bin/prisma generate

FROM node:22-alpine AS production
WORKDIR /deploy/app
ENV NODE_ENV=production
COPY --from=deploy /deploy/app ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
