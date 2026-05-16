FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY desktop/package.json ./desktop/
RUN pnpm install --frozen-lockfile

# Build shared
FROM deps AS shared-build
COPY packages/shared ./packages/shared
RUN pnpm --filter @senkronize/shared build

# Build backend
FROM shared-build AS backend-build
COPY apps/backend ./apps/backend
RUN pnpm --filter backend exec prisma generate && pnpm --filter backend build

# Production image
FROM node:22-alpine AS production
RUN npm install -g pnpm
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=backend-build /app/apps/backend/dist ./apps/backend/dist
COPY --from=backend-build /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=backend-build /app/packages/shared/dist ./packages/shared/dist
COPY --from=backend-build /app/packages/shared/package.json ./packages/shared/package.json
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

WORKDIR /app/apps/backend
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main.js"]
