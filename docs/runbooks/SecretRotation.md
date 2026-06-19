# Secret Rotation

Runbook xoay vòng 3 loại secret quan trọng của CollabSpace. Chạy khi: định kỳ 90 ngày, khi nghi ngờ lộ, hoặc khi thành viên team rời dự án.

**Môi trường áp dụng:** staging và production (k3s + Helm + Vault + ESO).  
**Local dev:** đổi giá trị trong `.env` tương ứng — không cần quy trình này.

---

## 1. JWT_SECRET

**Ảnh hưởng:** toàn bộ access token hiện tại bị invalidate ngay lập tức — người dùng phải đăng nhập lại.  
**Service bị tác động:** chỉ `auth-service` (ký token); các service khác verify qua gRPC với auth-service, không đọc `JWT_SECRET` trực tiếp.

### Bước thực hiện

1. **Thông báo maintenance** (production) hoặc ghi chú nhóm (staging).

2. **Tạo giá trị mới trong Vault:**
   ```sh
   vault kv patch secret/collabspace/<env> \
     jwt_secret="$(openssl rand -base64 48)"
   ```

3. **ESO sync** — ExternalSecret tự pull trong chu kỳ poll (mặc định 1 phút). Kiểm tra đã sync:
   ```sh
   kubectl -n collabspace get externalsecret auth-service-secrets \
     -o jsonpath='{.status.conditions[0]}'
   ```

4. **Rolling restart auth-service:**
   ```sh
   kubectl -n collabspace rollout restart deployment/auth-service
   kubectl -n collabspace rollout status deployment/auth-service
   ```

5. **Verify:**
   ```sh
   # Health sẵn sàng
   curl -s http://<HOST>/api/v1/auth/health/ready

   # Login thành công (token mới được ký với secret mới)
   curl -s -X POST http://<HOST>/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"<demo-user>","password":"<password>"}'
   ```

6. Ghi ngày rotate vào bảng [Lịch sử rotation](#lịch-sử-rotation) cuối file này.

---

## 2. SERVICE_JWT_SECRET

**Ảnh hưởng:** S2S (service-to-service) token giữa các service bị invalidate — API call nội bộ tạm thất bại trong khoảng thời gian rolling restart (~30 giây/service).  
**Services bị tác động:** `user-service`, `workspace-service`, `task-service`, `notification-service` (cả inbound verify lẫn outbound ký).

### Bước thực hiện

1. **Patch Vault — 1 giá trị duy nhất cho mọi service trong cùng env:**
   ```sh
   NEW_S2S="$(openssl rand -base64 48)"
   vault kv patch secret/collabspace/<env> \
     service_jwt_secret="${NEW_S2S}"
   ```

2. **Chờ ESO sync** trên cả 4 ExternalSecret:
   ```sh
   for svc in user-service workspace-service task-service notification-service; do
     kubectl -n collabspace get externalsecret ${svc}-secrets \
       -o jsonpath='{.status.conditions[0].message}'
     echo " ← ${svc}"
   done
   ```

3. **Rolling restart đồng thời cả 4 service** (không restart lần lượt — tránh window lệch secret):
   ```sh
   kubectl -n collabspace rollout restart \
     deployment/user-service \
     deployment/workspace-service \
     deployment/task-service \
     deployment/notification-service

   for svc in user-service workspace-service task-service notification-service; do
     kubectl -n collabspace rollout status deployment/${svc}
   done
   ```

4. **Verify** — lấy token user rồi gọi một API có S2S phía sau:
   ```sh
   TOKEN=$(curl -s -X POST http://<HOST>/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"<demo-user>","password":"<password>"}' \
     | jq -r '.accessToken')

   # workspace-service gọi user-service qua S2S bên trong
   curl -s -H "Authorization: Bearer $TOKEN" \
     http://<HOST>/api/v1/workspaces
   ```

5. Chạy `infrastructure/resilience/drills/verify-readiness.sh` để xác nhận tất cả 5 service healthy.

6. Ghi ngày rotate vào bảng [Lịch sử rotation](#lịch-sử-rotation).

---

## 3. Database passwords (PostgreSQL & MongoDB)

**Ảnh hưởng:** service mất kết nối DB trong khoảng thời gian rolling restart + Bitnami rolling restart — downtime ngắn (~1–2 phút/DB).  
**Services PostgreSQL:** `auth-service`, `user-service`, `workspace-service`.  
**Services MongoDB:** `task-service`, `notification-service`.

### 3a. PostgreSQL (Bitnami subchart)

1. **Tạo password mới:**
   ```sh
   NEW_PG_PASS="$(openssl rand -base64 32)"
   ```

2. **Đổi password trong Postgres trước** (tránh lock-out):
   ```sh
   kubectl -n collabspace exec -it \
     $(kubectl -n collabspace get pod -l app.kubernetes.io/name=postgresql -o name | head -1) \
     -- psql -U postgres -c \
     "ALTER USER collabspace PASSWORD '${NEW_PG_PASS}';"
   ```

3. **Patch Vault:**
   ```sh
   vault kv patch secret/collabspace/<env> \
     postgres_password="${NEW_PG_PASS}"
   ```

4. **Chờ ESO sync**, sau đó rolling restart 3 service:
   ```sh
   kubectl -n collabspace rollout restart \
     deployment/auth-service \
     deployment/user-service \
     deployment/workspace-service

   for svc in auth-service user-service workspace-service; do
     kubectl -n collabspace rollout status deployment/${svc}
   done
   ```

5. **Verify:**
   ```sh
   for port in 3000 3001 3002; do
     curl -s -o /dev/null -w ":%{http_code} " \
       http://<HOST>/api/v1/$(case $port in 3000) echo auth;; 3001) echo users;; 3002) echo workspaces;; esac)/health/ready
   done
   # Kỳ vọng: :200 :200 :200
   ```

### 3b. MongoDB (Bitnami subchart)

1. **Tạo password mới:**
   ```sh
   NEW_MONGO_PASS="$(openssl rand -base64 32)"
   ```

2. **Đổi password trong Mongo trước:**
   ```sh
   kubectl -n collabspace exec -it \
     $(kubectl -n collabspace get pod -l app.kubernetes.io/name=mongodb -o name | head -1) \
     -- mongosh -u root -p "${CURRENT_MONGO_ROOT_PASS}" --eval \
     "db.getSiblingDB('admin').changeUserPassword('collabspace','${NEW_MONGO_PASS}')"
   ```

3. **Patch Vault:**
   ```sh
   vault kv patch secret/collabspace/<env> \
     mongo_password="${NEW_MONGO_PASS}"
   ```

4. **Chờ ESO sync**, rolling restart 2 service:
   ```sh
   kubectl -n collabspace rollout restart \
     deployment/task-service \
     deployment/notification-service

   for svc in task-service notification-service; do
     kubectl -n collabspace rollout status deployment/${svc}
   done
   ```

5. **Verify:**
   ```sh
   curl -s http://<HOST>/api/v1/tasks/health/ready
   curl -s http://<HOST>/api/v1/notifications/health/ready
   ```

6. Ghi ngày rotate vào bảng [Lịch sử rotation](#lịch-sử-rotation).

---

## Rollback

Nếu sau rotate có service không healthy:

1. Vault cho phép đọc version cũ: `vault kv get -version=<n> secret/collabspace/<env>`.
2. Restore giá trị cũ: `vault kv patch ...` với giá trị version cũ.
3. Nếu đã đổi password DB, phải đổi lại trong DB trước khi patch Vault.
4. Rolling restart service liên quan.

---

## Lịch sử rotation

| Ngày | Loại secret | Môi trường | Người thực hiện | Ghi chú |
|------|-------------|------------|-----------------|---------|
| _(chưa có record)_ | | | | |

> Cập nhật bảng này sau mỗi lần rotate. Giữ 12 tháng lịch sử gần nhất.

---

**Tài liệu liên quan:**
- [backup-policy.md](../backup-policy.md) — RTO/RPO
- [runbooks/README.md](./README.md) — danh sách runbook
- [infrastructure/vault/README.md](../../infrastructure/vault/README.md) — Vault dev + ESO
- [phan-phu-tho-infrastructure-backlog.md](../team/phan-phu-tho-infrastructure-backlog.md) — backlog infra
