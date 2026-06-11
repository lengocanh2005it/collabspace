# RabbitMQDLQNotEmpty

**Alert:** DLQ queue has messages for 1 minute  
**Severity:** warning

## Symptoms

- Failed event processing; users may miss notifications or profile sync.

## Diagnosis

1. Inspect DLQ messages in RabbitMQ management UI.
2. Correlate `eventId` with service logs (notification dedupe, schema validation errors).

## Remediation

1. Fix the consumer bug or schema mismatch causing rejects.
2. Replay messages from DLQ only after the fix is deployed (manual re-publish with same `eventId` for idempotent handlers).
3. Monitor DLQ returns to zero.
