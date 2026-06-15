# Biome migration

Lộ trình tích hợp [Biome](https://biomejs.dev/) cho format + lint. **Trạng thái cuối (2026-06-15):** Biome format + lint cơ bản ở root; ESLint type-checked giữ song song — Phase 7 (bỏ ESLint) **đã đánh giá, không thực hiện**.

## Phase status

| Phase | Mô tả | Trạng thái |
|-------|--------|------------|
| 0 | Baseline toolchain | Done (2026-06-15) |
| 1 | Bootstrap Biome ở root | Done (2026-06-15) |
| 2 | Migrate format (Prettier → Biome) | Done (2026-06-15) |
| 3 | Tách Prettier khỏi ESLint | Done (2026-06-15) |
| 4 | Bật Biome linter | Done (2026-06-15) |
| 5 | CI + pre-commit | Done (2026-06-15) |
| 6 | Gỡ deps cũ + cập nhật docs | Done (2026-06-15) |
| 7 | (Tuỳ chọn) Bỏ ESLint | **Deferred** — đánh giá 2026-06-15, không làm |

## Phase 0 — Baseline (2026-06-15)

Chạy trên `main` working tree trước khi thêm Biome.

### Toolchain hiện tại

| Package | Format | Lint | Ghi chú |
|---------|--------|------|---------|
| `auth-service` | Prettier (`.prettierrc`: single quotes) | ESLint 9 + `recommendedTypeChecked` + Prettier plugin | |
| `user-service` | Prettier (single quotes) | ESLint 9 + type-checked + Prettier | **51 errors**, 7 warnings (2026-06-15) |
| `workspace-service` | Prettier (single quotes) | ESLint 9 + type-checked + Prettier | 0 errors, 25 warnings |
| `task-service` | Prettier default (double quotes) | ESLint 10 + type-checked + Prettier; `--format json` | |
| `notification-service` | Prettier default (double quotes) | ESLint 10 + type-checked + Prettier; `--format json` | 0 errors (JSON output) |
| `packages/shared` | — | `eslint` script **không có dep** | `pnpm run lint` từ root **fail** |
| `packages/nest-auth`, `packages/typeorm-migrate` | — | Không có script `lint` | |

### Quote style convention

- **Single quotes:** `auth-service`, `user-service`, `workspace-service` (`.prettierrc`)
- **Double quotes:** `task-service`, `notification-service` (xem `.claude/docs/coding-conventions.md`)

Biome overrides mirror convention này trong `biome.json`.

### Root commands (trước Phase 1)

| Command | Kết quả |
|---------|---------|
| `pnpm run build` | Pass (8/9 workspace packages) |
| `pnpm run test` | Pass |
| `pnpm run lint` | **Fail** — `packages/shared`: `eslint` not found |

### ESLint type-checked rules đang dùng (giữ qua Phase 3–6)

- `@typescript-eslint/no-floating-promises` (warn)
- `@typescript-eslint/no-unsafe-*` (warn, một số off trong `*.spec.ts`)
- `@typescript-eslint/no-explicit-any` (off)

### CI

`.github/workflows/ci.yml` chỉ chạy `build` + `test` — chưa enforce lint/format. *(Cập nhật ở Phase 5.)*

## Phase 1 — Bootstrap

- `@biomejs/biome@2.5.0` ở root `devDependencies`
- `biome.json` — formatter bật, **linter tắt** (`linter.enabled: false`)
- Scripts root: `format`, `format:check`, `biome:check`
- **Chưa** thay `pnpm run lint` hay workflow service hiện tại

### Lệnh mới (opt-in)

```sh
pnpm run format:check   # kiểm tra format, không ghi file
pnpm run format         # format services + packages (Phase 2)
pnpm run biome:check    # format check only (linter + assist off đến Phase 4)
```

`format:check` và `biome:check` hiện tương đương (chỉ formatter). Sau Phase 2, `format:check` nên pass; số lỗi format baseline Phase 1: **908** trên **709** files.

## Phase 2 — Format migration (2026-06-15)

- `pnpm run format` — áp dụng Biome format cho `services/` + `packages/` (**663** files sửa lần đầu + **145** sau khi bật decorator parser)
- `biome.json` — thêm `javascript.parser.unsafeParameterDecoratorsEnabled: true` (NestJS `@Inject()` trên constructor params)
- Xoá `.prettierrc` ở `auth-service`, `user-service`, `workspace-service`
- Script `format` ở 5 services → `pnpm -w exec biome format --write src test`
- **Giữ** `prettier` + `eslint-plugin-prettier` deps (Phase 3)

### Verify Phase 2

| Command | Kết quả |
|---------|---------|
| `pnpm run format:check` | Pass (709 files) |
| `pnpm run biome:check` | Pass |
| `pnpm run build` | Pass |
| `pnpm run test` | Pass |

**Lưu ý:** `pnpm run lint` vẫn dùng ESLint + Prettier plugin — có thể gây xung đột format cho đến Phase 3. Dev nên dùng `pnpm run format` (Biome) khi format tay.

## Phase 3 — ESLint type-checked only (2026-06-15)

- Package mới `@collabspace/eslint-config` — factory `createTypeCheckedEslintConfig()` dùng chung
- 5 services + `packages/shared`: bỏ `eslint-plugin-prettier`, bỏ rule `prettier/prettier`
- `packages/shared`: thêm `eslint` + `eslint.config.mjs` (fix lint script broken từ Phase 0)
- Gỡ `eslint-config-prettier` + `eslint-plugin-prettier` khỏi service `devDependencies`
- **Giữ** `prettier` package (Phase 6 gỡ hẳn)
- Root `pnpm run lint` = `biome:check` + `lint:types` (ESLint recursive)

### Verify Phase 3

| Command | Kết quả |
|---------|---------|
| `pnpm run format:check` | Pass |
| `pnpm run biome:check` | Pass |
| `pnpm run lint:types` | Pass trừ `user-service` (67 errors — đã có ~51 từ Phase 0) |
| `pnpm run lint` | `biome:check` + `lint:types` |
| `pnpm run build` | Pass |
| ESLint `--fix` vs Biome | Không xung đột format (`auth-service` verified) |
| `packages/shared` lint | Pass (1 warning) |

## Phase 4 — Biome linter (2026-06-15)

- `biome.json` — `linter.enabled: true`, `preset: "recommended"`
- Rule tuning (align ESLint): `noExplicitAny: off`, `noUnusedVariables`/`noUnusedFunctionParameters`/`noNonNullAssertion`: warn, **`useImportType: off`** (NestJS DI cần value import cho constructor tokens)
- Override `*.spec.ts`, `*.e2e-spec.ts`, `*.integration.spec.ts` — relax unused vars
- `pnpm exec biome check --write` (+ `--unsafe`) — auto-fix ~319 files (`useImportType`, unused imports, optional chain, …)
- Còn **29 warnings** (chủ yếu `noNonNullAssertion`, `noStaticOnlyClass`) — exit 0, xử lý dần
- Root: `biome:check` bật linter; thêm `biome:fix`
- Service `lint` = ESLint type-checked only (Biome chạy ở root trên `services packages`)

### Verify Phase 4

| Command | Kết quả |
|---------|---------|
| `pnpm run format:check` | Pass |
| `pnpm run biome:check` | Pass (29 warnings) |
| `pnpm run build` | Pass |
| `pnpm run test` | Pass |

## Phase 5 — CI + pre-commit (2026-06-15)

- **CI** (`.github/workflows/ci.yml`): job `lint` chạy `pnpm run lint:ci` trước `build-test` (`needs: lint`)
- **Pre-commit** (`.githooks/pre-commit`): sau check `.env`, chạy `biome check --staged` (format + lint trên file staged)
- Root scripts:
  - `lint:ci` = `format:check` + `biome:check` + `lint:types`
  - `lint` = alias của `lint:ci`
- `user-service/eslint.config.mjs`: align unsafe rules với `workspace-service` (warnings, không fail CI)
- Fix 2 ESLint errors còn lại ở `user-service` (cache `Promise.all` + unused var trong spec)

### Verify Phase 5

| Command | Kết quả |
|---------|---------|
| `pnpm run lint:ci` | Pass |
| `pnpm run format:check` | Pass |
| `pnpm run biome:check` | Pass (~38 warnings, exit 0) |
| `pnpm run lint:types` | Pass (0 errors; warnings only) |
| `pnpm run build` | Pass |
| `pnpm run test` | Pass |
| Pre-commit hook | `biome check --staged` (cần Git Bash / sh trên Windows) |

**Dev workflow:** `pnpm run lint` trước push; pre-commit tự format/lint file staged. Chi tiết: `.claude/docs/development-workflows.md` → Lint & format.

## Phase 6 — Cleanup + docs (2026-06-15)

- Gỡ `prettier` khỏi `devDependencies` của 5 NestJS services (không còn dùng sau Phase 2–3)
- `prettier` vẫn có thể xuất hiện trong lockfile như **peer transitive** của `@nestjs/cli` / `@nestjs/schematics` — không phải dep trực tiếp của app
- Cập nhật agent docs:
  - `.claude/docs/coding-conventions.md` — mục Format & lint (Biome + ESLint)
  - `.claude/docs/development-workflows.md` — đã có từ Phase 5
  - `.claude/skills/nest-service-change/SKILL.md` — verify format/lint
  - `.claude/skills/local-dev-verify/SKILL.md` — `lint:ci` trước push
  - `CLAUDE.md` — root lint/format commands
- Mirror skills: `scripts/sync-agent-docs.ps1`

### Verify Phase 6

| Command | Kết quả |
|---------|---------|
| `pnpm install` | Pass (lockfile cập nhật, không còn `prettier` direct dep) |
| `pnpm run lint:ci` | Pass |
| `pnpm run build` | Pass |
| `pnpm run test` | Pass |
| `rg prettier services/*/package.json` | Không match |

## Phase 7 — Đánh giá bỏ ESLint (2026-06-15, **không làm**)

Phase 7 ban đầu là tuỳ chọn: gỡ ESLint + `@collabspace/eslint-config`, chỉ còn Biome cho toàn bộ `pnpm run lint` / CI.

### Kết luận

**Giữ hybrid Biome + ESLint** — migration coi như **hoàn tất** ở Phase 6.

| Lý do | Chi tiết |
|-------|----------|
| Type-aware lint | ESLint `recommendedTypeChecked` bắt `no-floating-promises`, `no-unsafe-*`, `await-thenable` — hữu ích với NestJS bootstrap, gRPC, Mongoose, Redis cache |
| Biome chưa thay thế đủ | Không có bộ rule type-checked tương đương `typescript-eslint` cho codebase async này |
| NestJS / DI | Phase 4 đã thấy `useImportType` (Biome) phá `emitDecoratorMetadata` — cần `useImportType: off` và cẩn trọng với auto-fix |
| Chi phí / lợi ích | Gỡ ESLint tiết kiệm deps nhưng mất lớp an toàn; ~hàng trăm warnings `no-unsafe-*` đang ở mức warn, không block CI |

### Toolchain chốt (sau migration)

```text
format          → Biome (root biome.json)
lint style      → Biome (root: biome:check)
lint type-aware → ESLint per package (lint:types)
CI / local      → pnpm run lint  (= format:check + biome:check + lint:types)
pre-commit      → biome check --staged
```

### Khi nào xem lại Phase 7

Chỉ khi một trong các điều kiện sau đúng:

- Biome (hoặc plugin) hỗ trợ rule type-aware đủ cho NestJS/Mongo/gRPC, **và** có story an toàn cho decorator metadata
- Team chủ động cleanup toàn bộ `no-unsafe-*` / floating promises và chấp nhận mất lớp lint đó
- ESLint trở nên bottleneck rõ (thời gian CI, conflict config) — hiện chưa phải vấn đề

### Nếu làm Phase 7 trong tương lai (checklist tham khảo)

1. Audit rule gap: map từng rule trong `packages/eslint-config/create-type-checked-config.mjs` sang Biome hoặc `tsc --noEmit` / strict flags
2. Pilot một service; verify `pnpm run build` + `test` + không regress DI
3. Gỡ `eslint`, `typescript-eslint`, `eslint.config.mjs` từng package; xoá `@collabspace/eslint-config`
4. Đổi `lint:ci` → chỉ `format:check` + `biome:check`; cập nhật CI, pre-commit, agent docs

**Không có action bắt buộc** — doc này đóng lộ trình Biome migration.
