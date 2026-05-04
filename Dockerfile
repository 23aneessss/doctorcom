FROM oven/bun:1.2.20-alpine AS web-builder

WORKDIR /app

COPY package.json bun.lock turbo.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

RUN bun install --frozen-lockfile
RUN bun run --cwd apps/web build

FROM oven/bun:1.2.20-alpine

WORKDIR /app

COPY package.json bun.lock turbo.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY seed*.ts ./
COPY reset.ts ./
COPY deploy/web/runtime-config.template.js ./apps/server/public/runtime-config.template.js
COPY --from=web-builder /app/apps/web/dist ./apps/server/public

RUN bun install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST_DIR=/app/apps/server/public
ENV APP_SERVER_URL=

EXPOSE 3000

CMD ["/bin/sh", "-c", "sed \"s|\\${APP_SERVER_URL}|${APP_SERVER_URL}|g\" /app/apps/server/public/runtime-config.template.js > /app/apps/server/public/runtime-config.js && bun run start:server:with-migrations"]
