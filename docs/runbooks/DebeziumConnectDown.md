# Runbook: DebeziumConnectDown

**Triệu chứng:** Không có event mới trên Kafka topics; `curl http://localhost:8083/connectors` fail; container `debezium-connect` unhealthy.

## Kiểm tra nhanh

```powershell
docker compose -f infrastructure/docker/docker-compose.yml `
  -f infrastructure/docker/docker-compose.db.yml `
  -f infrastructure/docker/docker-compose.kafka.yml ps debezium-connect kafka

curl -s http://localhost:8083/connectors
curl -s http://localhost:8083/connectors/workspace-outbox-connector/status
```

## Xử lý

1. **Connect chưa healthy:** đợi ~60s lần đầu (tạo internal topics). `docker logs debezium-connect`.
2. **Kafka down:** khởi động lại `kafka` trước, sau đó `debezium-connect`.
3. **Connector FAILED:** xem status JSON — thường do Postgres `wal_level` không phải `logical`, replication slot, hoặc Mongo replica set.

   ```powershell
   .\scripts\register-workspace-outbox-connector.ps1
   .\scripts\register-user-outbox-connector.ps1
   .\scripts\register-task-outbox-connector.ps1
   ```

4. **Postgres WAL:** `docker exec postgres psql -U postgres -c "SHOW wal_level;"` → phải `logical`.

## Hậu quả

App vẫn INSERT outbox trong transaction — **không mất event** trong DB. Sau khi Connect phục hồi, CDC bắt kịp từ WAL/oplog (có thể burst lag tạm thời).

## Liên quan

- [infrastructure/kafka/README.md](../../infrastructure/kafka/README.md)
- [KafkaConsumerLagHigh.md](./KafkaConsumerLagHigh.md) nếu consumer lag sau reconnect
