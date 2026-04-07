# ================================
# Auth Service Dockerfile
# Stack: Node.js + Prisma + PostgreSQL
# Internal Port: 3000
# ================================

# --- Stage 1: Build ---
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci

# Copy source and generate Prisma client
COPY . .
RUN npx prisma generate

# --- Stage 2: Production ---
FROM node:18-alpine

WORKDIR /app

# Copy built app from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/auth/health || exit 1

CMD ["node", "src/index.js"]