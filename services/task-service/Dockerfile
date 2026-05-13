# ================================
# Task Service Dockerfile
# Stack: NestJS + MongoDB (CQRS)
# Internal Port: 3000
# Build: nest build requires @nestjs/cli
# ================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY nest-cli.json ./
COPY tsconfig*.json ./
RUN npm ci
# task-service doesn't have @nestjs/cli in deps — install it for build
RUN npx --yes @nestjs/cli --version || npm install --save-dev @nestjs/cli @nestjs/schematics

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

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/tasks/health || exit 1

CMD ["node", "dist/main.js"]