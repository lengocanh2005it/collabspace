# ================================
# Task Service Dockerfile
# Stack: Node.js + MongoDB (NO Prisma!)
# Internal Port: 3000
# ================================

# --- Stage 1: Build ---
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# NO prisma generate — task-service uses MongoDB with custom driver

# --- Stage 2: Production ---
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/tasks/health || exit 1

CMD ["node", "src/index.js"]