---
paths:
  - "services/auth-service/**"
---

# auth-service Rules

- Config qua `ConfigurationService` / `env.config.ts`; tránh `process.env` rải rác.
- Controllers inject use cases trực tiếp — không thêm `AppService` facade.
- DB qua `USER_REPOSITORY` / `REFRESH_TOKEN_REPOSITORY`; outbound qua `OTP_STORE`, `EMAIL_OUTBOX`, `USER_PROFILE_CLIENT`.
- Path alias `@/*` → `src/*`.
- Password: scrypt + salt; OTP hash trước khi lưu Redis; JWT qua `jose` HS256.
- Không log password, OTP, refresh token, access token.
- Email async qua `infrastructure/outbox/`, không gửi sync từ handler.
- Đổi identity trả về downstream → cập nhật HTTP `verify`, gRPC controller, consumers, `service-contracts.md`.
- Verify: `cd services/auth-service && pnpm run build && pnpm run test`.
