# ================================
# Workspace Service Dockerfile
# Stack: Java/Kotlin + Gradle + Flyway + PostgreSQL
# Internal Port: 8080 (NOT 3000!)
# ================================

# --- Stage 1: Build ---
FROM gradle:8-jdk17 AS builder

WORKDIR /app

# Copy Gradle wrapper and config first (cache layer)
COPY build.gradle* settings.gradle* gradle.properties* ./
COPY gradle ./gradle
RUN gradle dependencies --no-daemon || true

# Copy source and build
COPY . .
RUN gradle build --no-daemon -x test

# --- Stage 2: Production ---
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/workspaces/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]