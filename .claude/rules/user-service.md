---
paths:
  - "services/user-service/**"
---

# user-service Rules

- Layering: `presentation` → `application/use-cases` → `domain/repositories` → `infrastructure/repositories`.
- Inject `USER_PROFILE_REPOSITORY`; không return ORM entity từ controller.
- Cập nhật cả TypeORM và in-memory repository khi behavior đổi.
- Protected HTTP routes dùng `AuthGuard` + auth gRPC `VerifyAccessTokenLite`; `me` endpoints lấy `userId` từ `request.user.id`, không từ request body.
- Dev-only identity header `X-User-Id` chỉ bật khi `ALLOW_DEV_IDENTITY_HEADERS=true`.
- Internal replica API: `users/internal/replicas` — validate `X-Internal-Service-Token` (`INTERNAL_SERVICE_TOKEN`).
- Mapper rõ ràng (`toUserProfileResponseDto` pattern).
- ValidationPipe: whitelist + forbidNonWhitelisted trong `app.setup.ts`.
- Verify: `cd services/user-service && pnpm run build && pnpm run test`.
