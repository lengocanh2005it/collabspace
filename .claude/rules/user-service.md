---
paths:
  - "services/user-service/**"
---

# user-service Rules

- Layering: `presentation` → `application/use-cases` → `domain/repositories` → `infrastructure/repositories`.
- Inject `USER_PROFILE_REPOSITORY`; không return ORM entity từ controller.
- Cập nhật cả TypeORM và in-memory repository khi behavior đổi.
- `me` endpoints lấy `userId` từ auth identity, không từ request body.
- Mapper rõ ràng (`toUserProfileResponseDto` pattern).
- ValidationPipe: whitelist + forbidNonWhitelisted trong `app.setup.ts`.
- Verify: `cd services/user-service && pnpm run build && pnpm run test`.
