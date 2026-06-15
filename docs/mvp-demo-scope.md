# Phạm vi demo MVP CollabSpace

Tài liệu này định nghĩa **phạm vi demo MVP** và tiêu chí chấp nhận. Danh sách tính năng chi tiết và trạng thái implement: **[features.md](./features.md)** (nguồn chính).

## Mục tiêu

MVP tập trung vào một luồng demo ngắn nhưng trọn vẹn:

1. Đăng ký và xác thực email
2. Tạo workspace và mời thành viên
3. Tạo project / task
4. Gán task và đổi trạng thái
5. Comment có `@username`
6. Xem notification và đánh dấu đã đọc

## Kịch bản demo

1. User A đăng ký, verify email, đăng nhập
2. User A tạo workspace → mời User B
3. User B chấp nhận lời mời
4. User A tạo project → tạo 3 task → gán một task cho User B
5. User B đổi task sang `DOING` (board: cột `TODO` → `DOING`)
6. User A comment và mention `@user-b`
7. User B mở danh sách notification → `PATCH .../read` hoặc `read-all`

## Tiêu chí chấp nhận — backend API

Các API cốt lõi cho demo (theo [features.md](./features.md)):

- [x] Đăng ký, verify email, đăng nhập
- [x] Tạo workspace và thêm thành viên (invite + accept)
- [x] Tạo project và task trong workspace
- [x] Gán task và đổi trạng thái
- [x] Comment và mention `@username`
- [x] User B list notification (invite / assign / mention) + mark-read

Checklist chi tiết theo service: [mvp-roadmap.md — Demo Acceptance Checklist](../.claude/docs/mvp-roadmap.md#demo-acceptance-checklist).

## Xác minh demo — chưa đóng hết

API đã có; còn thiếu **chứng minh tự động** và client:

- [x] Script demo E2E 7 bước (`scripts/demo-e2e.sh` + `scripts/demo-e2e.ps1`)
- [x] Smoke qua Traefik gateway (`BASE_URL=http://localhost/api/v1` mặc định)
- [ ] Frontend / UI client trong repo
- [x] Gắn `demo-e2e` vào CI smoke sau deploy production (`run-demo-e2e-prod.sh` sau `helm-deploy-ci.sh`)

## Ngoài phạm vi

Xem [features.md — Ngoài phạm vi MVP](./features.md#ngoài-phạm-vi-mvp).

## Tài liệu liên quan

| Tài liệu | Dùng khi |
|----------|----------|
| [features.md](./features.md) | Trạng thái tính năng |
| [api-routes.md](./api-routes.md) | Route HTTP |
| [deployment-k3s-phases.md](./deployment-k3s-phases.md) | Deploy production — smoke test sau Phase 3 |
