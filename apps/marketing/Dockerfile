FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/marketing/package.json ./apps/marketing/
COPY desktop/package.json ./desktop/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/marketing ./apps/marketing
RUN pnpm --filter marketing build

FROM node:22-alpine AS production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=build /app/apps/marketing/.next/standalone ./
COPY --from=build /app/apps/marketing/.next/static ./apps/marketing/.next/static

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "apps/marketing/server.js"]
