# ================================
# Notification Service Dockerfile
# Stack: NestJS + Redis + RabbitMQ
# Internal Port: 3000
# NOTE: main.ts hardcodes port 3002 — override via PORT env var
# ================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY nest-cli.json ./
COPY tsconfig*.json ./
RUN npm ci

COPY . .
RUN npx nest build

# --- Stage 2: Production ---
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Force PORT=3000 to override the hardcoded 3002 in main.ts
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/notifications/health || exit 1

CMD ["node", "dist/main.js"]