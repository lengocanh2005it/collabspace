# Redis Sentinel Failover Drill — 2026-06-25

## Summary

| Item | Value |
|------|-------|
| Date | 2026-06-25 |
| Cluster | DOKS SGP1 — `pool-wdt5jtp8x` (3 × s-4vcpu-8gb) |
| Namespace | `collabspace` |
| Redis chart | Bitnami `redis` 20.7.0, `architecture: replication`, `sentinel.enabled: true` |
| Drill type | Delete current master pod, observe Sentinel-elected failover |
| Outcome | **PASS — no manual action required** |

## Timeline

| Time (UTC) | Event |
|------------|-------|
| 10:21:43 | Drill started. Master: `redis-node-0` (`10.150.0.18`, node `3cxv8s`) |
| 10:21:54 | `kubectl delete pod redis-node-0` executed |
| 10:22:16 | Sentinel elected `redis-node-1` as new master |
| 10:22:16 | All services logged `Redis client ready` (auto-reconnect, no restart) |
| 10:22:30 | All health endpoints returned 200 |
| ~10:23:30 | `redis-node-0` recovered as replica (2/2 Running) |

**Failover duration: ~22 seconds** (pod delete → new master confirmed by Sentinel)

## Before / After

| State | Master pod | Master host |
|-------|-----------|-------------|
| Before drill | `redis-node-0` | `redis-node-0.redis-headless.collabspace.svc.cluster.local` |
| After drill | `redis-node-1` | `redis-node-1.redis-headless.collabspace.svc.cluster.local` |

## App behavior

| Service | Behavior | Errors |
|---------|----------|--------|
| `auth-service` | Auto-reconnect via Sentinel | None (brief WARN suppressed by ioredis internals) |
| `notification-service` | 1× WARN "All sentinels unreachable. Retrying from scratch after 10ms." then reconnected | Expected — brief sentinel connection glitch during pod restart window |
| `task-service` | Same as notification-service | Expected |
| `user-service` | Auto-reconnect | None visible in last 20 lines |
| `workspace-service` | Auto-reconnect | None visible in last 20 lines |

**No service restart required. No manual intervention needed.**

## Health check results (post-failover)

```
auth        → 200
users       → 200
workspaces  → 200
tasks       → 200
notifications → 200
```

## Notes

- Bitnami Sentinel with `downAfterMilliseconds: 60000` means the actual quorum vote happens within
  that window. The pod was rescheduled quickly, so actual failover was much faster than 60s.
- `REDIS_SENTINELS=redis:26379` — both sentinels run as sidecars on each Redis node, so the
  service endpoint `redis:26379` load-balances between live sentinels automatically.
- `maxRetriesPerRequest: 1` in app clients means a brief command failure is possible during the
  switch window; caches miss and repopulate on next request — acceptable per product requirements.
- Notification pub/sub recovered via the duplicated client; no lost pub/sub messages were observed.

## Drill verdict

Redis Sentinel failover on DOKS works as designed. OTP/session flows are unaffected after the
brief reconnect window. Cluster is HA-capable with 2 nodes and quorum=2.
