# ServiceDown

**Cảnh báo:** `up == 0` trong 1 phút  
**Mức độ:** critical

## Triệu chứng

- Prometheus không scrape được `/metrics` hoặc process không lắng nghe.
- Gateway trả `502/503` cho route thuộc service đó.
- Readiness probe Kubernetes fail; pod bị loại khỏi Service endpoints.

## Chẩn đoán

1. Kiểm tra trạng thái container/pod: `docker ps` hoặc `kubectl -n collabspace get pods -l app=<service>`.
2. Xem log: `kubectl logs deploy/<service>` hoặc Grafana **Explore → Loki** — `{namespace="collabspace", app="<service>"}` ([observability.md](../observability.md)).
3. Metric: Grafana **Service Health** hoặc `up{job="<service>"}` trên Prometheus.
4. Verify `/health/live` trả 200 (process sống) so với `/health/ready` (dependency OK).

## Khắc phục

1. Restart container hoặc roll deployment.
2. Nếu crash-loop, sửa lỗi khởi động (DB URL, thiếu env, migration fail).
3. Xác nhận dependency healthy (Postgres, Redis, Mongo, Kafka, Debezium Connect) trước khi coi là xong.
4. Chạy lại `infrastructure/resilience/drills/verify-readiness.ps1`.

## Leo thang

Nếu nhiều service down cùng lúc, kiểm tra hạ tầng dùng chung (Docker network, Postgres, Kafka) trước.
