# RabbitMQHighQueueDepth

**Cảnh báo:** `rabbitmq_queue_messages > 1000` trong 5 phút  
**Mức độ:** warning

## Triệu chứng

- Event trễ (notification chậm, outbox tồn đọng).
- Consumer pod có thể down hoặc chậm.

## Chẩn đoán

1. Mở RabbitMQ management UI (cổng 15672) và xem độ sâu hàng đợi.
2. Kiểm tra notification-service và consumer auth/user đang chạy.
3. Xem runbook DLQ nếu message poison.

## Khắc phục

1. Scale consumer (replica notification-service).
2. Sửa consumer crash (xem log).
3. Sau khi sửa root cause, theo dõi hàng đợi giảm dần.
4. Tải cao kéo dài: tune `prefetchCount` và interval poll outbox.
