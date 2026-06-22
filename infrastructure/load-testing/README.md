# CollabSpace load testing (k6)

k6 chạy qua **API gateway** (`BASE_URL=.../api/v1`), không gọi thẳng từng pod.

## Scenarios

| File | Mục đích | Mặc định |
|------|----------|----------|
| `k6/scenarios/smoke.js` | Health 5 app services | 5 VU, 1 phút |
| `k6/scenarios/demo-flow.js` | Login demo users → workspaces, board, notifications | stages 10 VU |
| `k6/scenarios/slo-baseline.js` | Hot read paths + per-route p95 SLO thresholds | 10 VU, 2 phút |

Legacy per-service scripts: `k6/scripts/*.js` (health cũ — giữ tham chiếu).

## Chạy nhanh

```bash
# Cần cài k6: https://grafana.com/docs/k6/latest/set-up/install-k6/
cp k6/.env.example k6/.env   # chỉnh BASE_URL

BASE_URL=http://localhost/api/v1 ./run-load-test.sh smoke
BASE_URL=http://localhost/api/v1 ./run-load-test.sh demo-flow
BASE_URL=http://localhost/api/v1 ./run-load-test.sh slo-baseline
```

**Prod smoke (script):** `../deploy/run-k6-smoke-prod.sh`

## Grafana annotations

Khi set `GRAFANA_URL`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, k6 gọi API annotation → marker trên dashboard **CollabSpace Load Test Run**.

## Chạy trên DOKS (không cần cài k6 local)

```bash
# 1. Tạo secret (chỉ cần làm một lần)
kubectl create secret generic k6-config -n collabspace \
  --from-literal=userPassword=<seed-password> \
  --from-literal=grafanaPassword=<grafana-admin-password>

# 2. Apply ConfigMaps + chạy Job (mặc định: smoke, 10 VU, 2 phút)
kubectl apply -f infrastructure/load-testing/k6-job.yaml

# 3. Xem kết quả
kubectl logs -n collabspace -l app=k6-load-test -f

# 4. Xóa Job sau khi xong (hoặc tự xóa sau 10 phút qua ttlSecondsAfterFinished)
kubectl delete job k6-load-test -n collabspace
```

**Đổi scenario / VUs** — patch trực tiếp hoặc dùng `kubectl set env`:

```bash
# Chạy slo-baseline với 20 VU
kubectl set env job/k6-load-test K6_SCENARIO=slo-baseline K6_VUS=20 -n collabspace

# Hoặc edit file rồi re-apply (Job cần xóa trước)
kubectl delete job k6-load-test -n collabspace
# Sửa K6_SCENARIO / K6_VUS trong k6-job.yaml
kubectl apply -f infrastructure/load-testing/k6-job.yaml
```

## Docker Compose

```bash
cd infrastructure/docker
cp ../load-testing/k6/.env.example ../load-testing/k6/.env
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.loadtest.yml run --rm k6
```

Set `K6_SCRIPT=scenarios/smoke.js` trong `.env`.

## Env

| Biến | Mô tả |
|------|--------|
| `BASE_URL` | Gateway API, ví dụ `http://host/api/v1` |
| `K6_VUS` | Virtual users (smoke) |
| `K6_DURATION` | Thời lượng smoke |
| `K6_USER_A_EMAIL` / `K6_USER_B_EMAIL` | Demo users (sau seed) |
| `K6_USER_PASSWORD` | Mặc định `collabspace123` |
| `GRAFANA_URL` | Ví dụ `http://host/grafana` (subpath) |

## Quan sát khi chạy

1. Grafana → **Load Test Run** (metric)
2. Grafana → **App Logs** (xu hướng lỗi)
3. Grafana → **Explore → Loki** (tail log)

Xem [docs/observability.md](../../docs/observability.md).
