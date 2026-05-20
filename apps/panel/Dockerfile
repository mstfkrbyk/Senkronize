FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @senkronize/shared build
RUN pnpm --filter panel build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/panel/dist /usr/share/nginx/html
COPY nginx/panel.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
