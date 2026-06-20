# Runbook: KafkaDlqNotEmpty

**Alert:** `KafkaDlqNotEmpty` (warning)  
**Expr:** có message mới trên topic `collabspace.dlq.events`

## Ý nghĩa

Sau `KAFKA_CONSUMER_MAX_RETRIES` (mặc định 3), consumer gửi envelope DLQ thay vì block consumer group (thay RabbitMQ DLQ).

Envelope schema: `infrastructure/kafka/schemas/kafka-dlq-envelope.v1.json`

## Kiểm tra nhanh

```powershell
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh `
  --bootstrap-server localhost:9092 `
  --topic collabspace.dlq.events `
  --from-beginning `
  --max-messages 5 `
  --timeout-ms 15000
```

Hoặc Kafka UI: http://localhost:8088 (profile `kafka-ui`).

## Xử lý

1. Đọc `errorMessage` và `sourceTopic` trong envelope.
2. Sửa root cause (bug handler, dependency down, payload sai format).
3. **Replay** sau khi sửa:

```powershell
.\scripts\kafka-replay-dlq.ps1 -DryRun   # xem trước
.\scripts\kafka-replay-dlq.ps1 -MaxMessages 10
```

Chi tiết: [infrastructure/kafka/REPLAY.md](../../infrastructure/kafka/REPLAY.md)

4. Xác nhận side-effect đúng (notification, replica sync, v.v.) — handlers phải idempotent nếu replay trùng `eventId`.

## Dev reset DLQ topic

Chỉ môi trường dev — xóa topic và tạo lại (xem REPLAY.md).

## Biến môi trường

| Biến | Mặc định |
|------|----------|
| `KAFKA_DLQ_TOPIC` | `collabspace.dlq.events` |
| `KAFKA_CONSUMER_MAX_RETRIES` | `3` |
| `KAFKA_CONSUMER_RETRY_DELAY_MS` | `1000` |
