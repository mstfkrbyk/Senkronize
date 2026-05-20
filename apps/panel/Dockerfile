FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/panel/package.json ./apps/panel/
COPY packages/shared/package.json ./packages/shared/
COPY desktop/package.json ./desktop/
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG VITE_API_URL=http://localhost:3001/api/v1
ARG VITE_DEMO_MODE=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
COPY packages/shared ./packages/shared
RUN pnpm --filter @senkronize/shared build
COPY apps/panel ./apps/panel
RUN pnpm --filter panel build

FROM nginx:alpine AS production
COPY --from=build /app/apps/panel/dist /usr/share/nginx/html
COPY apps/panel/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
