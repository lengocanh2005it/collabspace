# HighErrorRate5xx

**Cảnh báo:** tỷ lệ 5xx > 5% trong 5 phút  
**Mức độ:** warning

## Triệu chứng

- `http_requests_total{status=~"5.."}` tăng trên Prometheus.
- User gặp lỗi server gián đoạn.

## Chẩn đoán

1. Xác định nhãn job (`auth-service`, `task-service`, …) trong alert.
2. Kiểm tra deploy gần đây và outage dependency (`/health/ready` trên service bị ảnh hưởng).
3. Xem log service tìm stack trace trong cửa sổ alert.
4. Với task-service, kiểm tra `WORKSPACE_SERVICE_UNAVAILABLE` khi workspace down.

## Khắc phục

1. Rollback deployment cuối nếu lỗi bắt đầu sau release.
2. Khôi phục dependency (xem runbook PostgresDown, MongoDown, RabbitMQ).
3. Scale replica nếu nghi ngờ quá tải (K8s HPA hoặc tăng replica thủ công).
4. Xác nhận tỷ lệ lỗi về bình thường trên Grafana/Prometheus trong 10 phút.
