# RabbitMQDLQNotEmpty

**Cảnh báo:** hàng đợi DLQ có message trong 1 phút  
**Mức độ:** warning

## Triệu chứng

- Xử lý event thất bại; user có thể thiếu notification hoặc sync profile.

## Chẩn đoán

1. Inspect message DLQ trong RabbitMQ management UI.
2. Đối chiếu `eventId` với log service (dedupe notification, lỗi validate schema).

## Khắc phục

1. Sửa bug consumer hoặc lệch schema gây reject.
2. Replay message từ DLQ **chỉ sau** khi fix đã deploy (re-publish thủ công cùng `eventId` cho handler idempotent).
3. Theo dõi DLQ về 0.
