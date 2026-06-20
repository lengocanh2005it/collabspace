# Runbook: KafkaConsumerLagHigh

**Alert:** `KafkaConsumerLagHigh` (warning)  
**Expr:** `sum by (consumergroup) (kafka_consumergroup_lag) > 100` for 5m

## Ý nghĩa

Consumer group không theo kịp tốc độ produce từ Debezium → lag tăng. Thường do consumer chậm, down, hoặc handler lỗi lặp lại.

## Kiểm tra nhanh

```powershell
# Consumer groups + lag (trong container kafka)
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups

# Prometheus / Grafana
# metric: kafka_consumergroup_lag{consumergroup="notification-service-workspace-events"}
```

CollabSpace consumer groups (suffix trên `KAFKA_GROUP_ID`):

| Service | Groups |
|---------|--------|
| notification-service | `notification-service-workspace-events`, `-user-events`, `-task-events` |
| task-service | `task-service-workspace-events`, `-user-events` |

## Xử lý

1. **Service down:** restart `notification-service` / `task-service`; xác nhận `KAFKA_CONSUMERS_ENABLED=true`.
2. **Handler lỗi:** xem log NestJS — message lỗi sau retry sẽ vào DLQ (`collabspace.dlq.events`). Xem [KafkaDlqNotEmpty.md](./KafkaDlqNotEmpty.md).
3. **Debezium spike:** kiểm tra connector status `curl http://localhost:8083/connectors` — xem [DebeziumConnectDown.md](./DebeziumConnectDown.md).
4. **Tạm thời scale:** tăng replica consumer service (prod) hoặc giảm batch produce (dev).

## Phòng ngừa

- Idempotent handlers theo `eventId` (`.claude/docs/resilience.md`).
- Giám sát `kafka-exporter` (Phase 7) trong stack monitoring.
