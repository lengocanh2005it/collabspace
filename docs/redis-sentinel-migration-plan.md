# Redis Sentinel migration plan

> Scope: migrate CollabSpace from the current single Redis master
> (`redis-master:6379`) to Redis replication + Sentinel on DOKS, while keeping
> local/dev able to run the existing standalone Redis path.
>
> Status at time of writing: planning document only. Do not treat this as
> already implemented.

## Why migrate

Current Redis is a single Bitnami Redis master. If `redis-master-0` is
restarted or rescheduled, Redis-dependent flows can fail until the pod is ready.
For CollabSpace that affects:

- `auth-service`: email OTP, refresh/session supporting state, access-token
  verify-lite cache.
- `user-service`: profile/preferences/status cache.
- `workspace-service`: workspace/list cache.
- `task-service`: workspace membership cache.
- `notification-service`: unread count cache and realtime pub/sub.

Redis data is treated as transient in this project: OTP/cache/session support can
be lost and Redis backup is not mandatory. Sentinel is therefore mainly for
availability and faster failover, not durable recovery.

## Current state

### Helm Redis

Files:

- `infrastructure/helm/collabspace/values.yaml`
- `infrastructure/helm/collabspace/values-prod.example.yaml`
- `infrastructure/helm/collabspace/templates/_helpers.tpl`
- `infrastructure/helm/collabspace/templates/apps/configmap.yaml`
- `infrastructure/helm/collabspace/templates/observability/exporters.yaml`
- `infrastructure/helm/collabspace/templates/network-policies.yaml`

Current values:

```yaml
infra:
  hosts:
    redis: redis-master

redis:
  enabled: true
  fullnameOverride: redis
  architecture: standalone
  auth:
    enabled: true
    password: collabspace123
  master:
    persistence:
      enabled: true
      size: 2Gi
```

Current app env uses `REDIS_HOST=redis-master`, `REDIS_PORT=6379`,
`REDIS_DB=0`, and `REDIS_PASSWORD`.

### App Redis clients

Current clients use `ioredis` with URL or host/port:

- `services/auth-service/src/infrastructure/redis/redis.module.ts`
- `services/user-service/src/infrastructure/cache/redis.module.ts`
- `services/workspace-service/src/infrastructure/cache/redis.module.ts`
- `services/task-service/src/infrastructure/cache/redis.module.ts`
- `services/notification-service/src/infrastructure/cache/redis.module.ts`

Important behavior today:

- `auth-service` always creates a Redis client. Redis failures matter for OTP and
  can return `REDIS_UNAVAILABLE`.
- `user-service`, `workspace-service`, `task-service`, and
  `notification-service` return `null` if no Redis host/url is configured; cache
  usage is mostly fail-open.
- `notification-service` uses `redis.duplicate()` for pub/sub. Sentinel config
  must also work for duplicated clients.
- `REDIS_URL` currently takes precedence in several services. If Sentinel is
  enabled, do not set `REDIS_URL` unless the service code explicitly gives
  Sentinel precedence.

### Network policy gap

Current Redis network policy allows only:

```yaml
values: [auth-service, user-service, notification-service]
ports:
  - port: 6379
```

But `workspace-service` and `task-service` also have `REDIS_HOST` in Helm values.
For Sentinel, update this policy to include all Redis clients and port `26379`:

```yaml
values:
  - auth-service
  - user-service
  - workspace-service
  - task-service
  - notification-service
ports:
  - port: 6379
  - port: 26379
```

## Target architecture

Use the existing Bitnami Redis chart dependency (`redis` chart version `20.7.0`)
in replication mode with Sentinel enabled.

Key Bitnami values from the local chart:

```yaml
redis:
  architecture: replication
  auth:
    enabled: true
    sentinel: true
  sentinel:
    enabled: true
    masterSet: mymaster
    quorum: 2
    service:
      ports:
        redis: 6379
        sentinel: 26379
    downAfterMilliseconds: 60000
    failoverTimeout: 180000
    parallelSyncs: 1
```

With `fullnameOverride: redis` and `sentinel.enabled: true`, Bitnami creates a
single Redis service exposing both Redis and Sentinel ports. The app clients
should discover the current master through Sentinel instead of writing to the
old `redis-master` service directly.

Recommended DOKS sizing for the first migration:

```yaml
redis:
  architecture: replication
  replica:
    replicaCount: 2
```

This gives:

- 1 current master
- 2 Redis replicas
- 3 Sentinel sidecars/containers participating in quorum

Avoid `replicaCount: 1` with `quorum: 2`; failover will not be reliable. If
capacity is still too tight, do not fake HA with too few replicas. Add node
capacity or keep standalone.

## Capacity estimate

> **Note:** This section was updated on 2026-06-24 to reflect the new DOKS cluster
> (`pool-wdt5jtp8x`, 3 × `s-4vcpu-8gb`). The previous cluster (`pool-r0ba46mj2`,
> 3 × `s-2vcpu-4gb`) has been decommissioned. Headroom is significantly better.

Latest DOKS snapshot, measured on 2026-06-24 ICT:

```text
kubectl top nodes

pool-wdt5jtp8x-3cxv85   571m   14%   2987Mi   46%
pool-wdt5jtp8x-3cxv8p   1015m  26%   4164Mi   64%
pool-wdt5jtp8x-3cxv8s   483m   12%   2603Mi   40%
```

Each node: **4 vCPU / 8 GiB RAM** — allocatable `3890m CPU` / `6568Mi memory`.

Scheduler pressure from `kubectl describe nodes`:

| Node | CPU request | Memory request | Notable pods | Note |
|------|-------------|----------------|--------------|------|
| `3cxv85` | 1922m / 3890m (49%) | 2685Mi / 6568Mi (41%) | `redis-master-0`, `mongo-1`, `kafka-exporter`, `mongodb-exporter` | Good headroom; current Redis master lives here |
| `3cxv8p` | 1532m / 3890m (39%) | 2833Mi / 6568Mi (44%) | `kafka-0`, `debezium-connect`, `mongo-arbiter-0` | Kafka + Debezium JVM; avoid adding more stateful pods here |
| `3cxv8s` | 1172m / 3890m (30%) | 1511Mi / 6568Mi (23%) | `mongo-0`, `redis-exporter` | Best headroom — preferred target for new Redis replicas |

Current hot pods from `kubectl top pods -n collabspace`:

| Pod | CPU | Memory | Note |
|-----|-----|--------|------|
| `debezium-connect` | 29m | 491Mi | Biggest memory consumer (JVM) |
| `kafka-0` | 483m | 481Mi | Biggest live CPU user (JVM) |
| `mongo-1` | 150m | 466Mi | MongoDB secondary |
| `mongo-0` | 200m | 288Mi | MongoDB primary |
| `task-service` | 88m | 109Mi | Highest-CPU app service |
| `notification-service` | 92m | 97Mi | |
| `redis-master-0` | 25m | 10Mi | Redis live usage is very small |

Current standalone Redis request footprint:

```text
redis-master-0: 100m CPU request, 128Mi memory request, 2Gi PVC
```

Proposed initial Sentinel resources:

```yaml
redis:
  master:
    resources:
      requests:
        cpu: 50m
        memory: 128Mi
      limits:
        cpu: 250m
        memory: 384Mi
  replica:
    replicaCount: 2
    persistence:
      enabled: true
      size: 2Gi
      storageClass: do-block-storage
    resources:
      requests:
        cpu: 50m
        memory: 128Mi
      limits:
        cpu: 250m
        memory: 384Mi
  sentinel:
    resources:
      requests:
        cpu: 25m
        memory: 64Mi
      limits:
        cpu: 100m
        memory: 128Mi
```

Expected extra request vs current:

- Redis data containers: current 1 × `100m / 128Mi`, target 3 × `50m / 128Mi`.
- Sentinel sidecar containers: 3 × `25m / 64Mi`.
- Net CPU request change: roughly `+25m` (from 100m to 3×50m + 3×25m = 225m total).
- Net memory request increase: roughly `+448Mi` (from 128Mi to 576Mi total).
- Storage: current `1 × 2Gi`; target `3 × 2Gi = 6Gi`.

With the new 8 GiB nodes, all three nodes have ample headroom. The extra
`~150m CPU` and `~450Mi memory` across the cluster is well within capacity.
Spread Redis/Sentinel pods across nodes using `podAntiAffinity`. Prefer
scheduling new replicas on `3cxv8s` (lowest request pressure) and avoid
stacking more JVM workloads on `3cxv8p`.

Post-migration estimated scheduler requests:

- `3cxv85`: ~1947m CPU (50%) / ~2813Mi memory (43%) — master pod stays here.
- `3cxv8p`: ~1557m CPU (40%) / ~2897Mi memory (44%) — one Sentinel sidecar only.
- `3cxv8s`: ~1297m CPU (33%) / ~1767Mi memory (27%) — best fit for 1–2 replicas.

## Migration strategy

Use a two-release migration:

1. Deploy app code that supports both standalone Redis and Sentinel, but keep
   Redis in standalone mode.
2. Switch Helm Redis from standalone to Sentinel and change app env to Sentinel
   mode.

This keeps rollback simple. If app code has a bug, rollback before changing
Redis topology. If Redis topology has a problem, rollback Helm values while the
app still supports standalone.

Redis data can be treated as disposable for this project. A brief OTP/cache loss
is acceptable if announced during the maintenance window. Do not attempt a
complex data migration unless product requirements change.

## Phase 0 - Preflight

### 0.1 Confirm all workloads are healthy

```powershell
kubectl get deploy -n collabspace
kubectl get statefulset -n collabspace
kubectl get daemonset -n collabspace
kubectl get pods -n collabspace
```

Expected:

- All app deployments `1/1`.
- `redis-master` `1/1`.
- `mongo`, `mongo-arbiter`, `kafka`, `loki`, `postgres-*` healthy.
- No persistent `Pending` pods.

### 0.2 Confirm headroom

`metrics-server` is installed from `infrastructure/k8s/metrics-server.yaml`, so
use live usage first:

```powershell
kubectl top nodes
kubectl top pods -n collabspace
```

Also inspect scheduler requests, because `Insufficient cpu` is based on
requests rather than live CPU usage:

```powershell
kubectl describe nodes
```

Target before enabling Sentinel:

- Worst node CPU request below roughly `85%`.
- No memory pressure.
- Enough room for at least three new/surged Redis/Sentinel containers during
  rollout.
- Prefer one Redis/Sentinel pod per node. Current best target for new stateful
  pods is `pool-wdt5jtp8x-3cxv8s` (lowest pressure); avoid adding more
  memory-heavy pods to `pool-wdt5jtp8x-3cxv8p` (Kafka + Debezium already there).

If Metrics API ever disappears, verify it with:

```powershell
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl get pods -A -l k8s-app=metrics-server
```

### 0.3 Snapshot current Redis objects

Do not print secrets. Only inspect object names/status:

```powershell
kubectl get svc,statefulset,pod,pvc -n collabspace -l app.kubernetes.io/name=redis
kubectl get networkpolicy allow-redis-clients -n collabspace -o yaml
```

Optional check from inside the cluster:

```powershell
kubectl exec -n collabspace redis-master-0 -- redis-cli -a '<password-from-secret>' ping
```

Do not paste the password into logs/chat.

## Phase 1 - Add Sentinel-capable app client code

### 1.1 New env contract

Add these config keys while preserving existing standalone keys:

```text
REDIS_MODE=standalone|sentinel
REDIS_URL=
REDIS_HOST=redis-master
REDIS_PORT=6379
REDIS_DB=0
REDIS_USERNAME=
REDIS_PASSWORD=<secret>
REDIS_KEY_PREFIX=<service-prefix>

REDIS_SENTINELS=redis:26379
REDIS_SENTINEL_NAME=mymaster
REDIS_SENTINEL_PASSWORD=<optional; default REDIS_PASSWORD>
REDIS_SENTINEL_CONNECT_TIMEOUT_MS=10000
REDIS_SENTINEL_COMMAND_TIMEOUT_MS=5000
```

Rules:

- Default mode should remain `standalone`.
- If `REDIS_MODE=sentinel`, ignore `REDIS_URL` and use Sentinel options.
- If `REDIS_MODE` is unset and `REDIS_SENTINELS` is set, it is acceptable to
  infer Sentinel mode, but explicit `REDIS_MODE=sentinel` is clearer for prod.
- `REDIS_SENTINEL_NAME` must match Bitnami `redis.sentinel.masterSet`.
- Keep `REDIS_PASSWORD` as the Redis server auth password.
- Use `REDIS_SENTINEL_PASSWORD` only if Sentinel auth diverges. With Bitnami
  `auth.sentinel=true`, it normally matches `REDIS_PASSWORD`.

### 1.2 Shared parser behavior

Each service can implement locally first, but the logic should be identical.
Suggested parsing behavior:

```ts
type RedisMode = 'standalone' | 'sentinel';

type ParsedSentinel = {
  host: string;
  port: number;
};

function parseRedisSentinels(value?: string): ParsedSentinel[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [host, rawPort] = item.split(':');
      return {
        host,
        port: Number(rawPort || 26379),
      };
    })
    .filter((item) => item.host && Number.isFinite(item.port));
}
```

### 1.3 ioredis options

Standalone:

```ts
new Redis({
  host,
  port,
  db,
  password,
  username,
  keyPrefix,
  lazyConnect: false,
  maxRetriesPerRequest: 1,
});
```

Sentinel:

```ts
new Redis({
  sentinels,
  name: sentinelName,
  db,
  password,
  username,
  sentinelPassword,
  keyPrefix,
  lazyConnect: false,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  connectTimeout: sentinelConnectTimeoutMs,
  commandTimeout: sentinelCommandTimeoutMs,
});
```

Notes:

- `name` is the Sentinel master set name, not the Kubernetes service name.
- `sentinels` should point to Sentinel port `26379`, not Redis port `6379`.
- `password` authenticates to Redis.
- `sentinelPassword` authenticates to Sentinel when Sentinel auth is enabled.
- Do not use `keyPrefix` on pub/sub channel names if channel interoperability is
  expected. The existing `notification-service` uses the same duplicated client;
  verify its pub/sub behavior under Sentinel.

### 1.4 Service-specific files to update

Auth:

- `services/auth-service/src/configuration/env.config.ts`
- `services/auth-service/src/configuration/configuration.service.ts`
- `services/auth-service/src/infrastructure/redis/redis.module.ts`
- Add/adjust tests for `getRedisOptions()` and client construction.

User:

- `services/user-service/src/infrastructure/cache/redis.module.ts`
- Add tests for standalone, disabled, and Sentinel config.

Workspace:

- `services/workspace-service/src/infrastructure/cache/redis.module.ts`
- Add tests for standalone, disabled, and Sentinel config.

Task:

- `services/task-service/src/infrastructure/cache/redis.module.ts`
- Add tests for standalone, disabled, and Sentinel config.

Notification:

- `services/notification-service/src/infrastructure/cache/redis.module.ts`
- `services/notification-service/src/application/services/notification-realtime.service.ts`
- Add a test or mock assertion that `redis.duplicate()` is still called and does
  not drop Sentinel options.

### 1.5 Keep backward compatibility

After Phase 1 deploy, the following must still work:

```yaml
REDIS_HOST: redis-master
REDIS_PORT: "6379"
REDIS_DB: "0"
REDIS_PASSWORD: from secret
```

Do not set Sentinel envs yet.

### 1.6 Verify Phase 1

Run targeted builds/tests:

```powershell
pnpm --filter auth-service run build
pnpm --filter auth-service run test
pnpm --filter user-service run build
pnpm --filter workspace-service run build
pnpm --filter task-service run build
pnpm --filter notification-service run build
```

If using repo root CI-equivalent:

```powershell
pnpm run lint
pnpm run build
pnpm run test
```

Deploy app code while Redis is still standalone. Verify:

```powershell
kubectl rollout status deployment/auth-service -n collabspace
kubectl rollout status deployment/user-service -n collabspace
kubectl rollout status deployment/workspace-service -n collabspace
kubectl rollout status deployment/task-service -n collabspace
kubectl rollout status deployment/notification-service -n collabspace
```

Health:

```powershell
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/auth/health/ready
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/users/health/ready
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/workspaces/health/ready
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/tasks/health/ready
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/notifications/health/ready
```

## Phase 2 - Update Helm for Sentinel

### 2.1 Helm values

Update `infrastructure/helm/collabspace/values.yaml` and
`values-prod.example.yaml`.

Example target:

```yaml
infra:
  hosts:
    redis: redis

redis:
  enabled: true
  fullnameOverride: redis
  architecture: replication
  auth:
    enabled: true
    sentinel: true
    password: collabspace123
  master:
    persistence:
      enabled: true
      size: 2Gi
      storageClass: do-block-storage
    resources:
      requests:
        memory: 128Mi
        cpu: 50m
      limits:
        memory: 384Mi
        cpu: 250m
  replica:
    replicaCount: 2
    persistence:
      enabled: true
      size: 2Gi
      storageClass: do-block-storage
    resources:
      requests:
        memory: 128Mi
        cpu: 50m
      limits:
        memory: 384Mi
        cpu: 250m
  sentinel:
    enabled: true
    masterSet: mymaster
    quorum: 2
    resources:
      requests:
        memory: 64Mi
        cpu: 25m
      limits:
        memory: 128Mi
        cpu: 100m
    service:
      ports:
        redis: 6379
        sentinel: 26379
```

Local/dev can either keep standalone in `values-local.yaml`, or explicitly set:

```yaml
redis:
  architecture: standalone
  sentinel:
    enabled: false
```

### 2.2 App env in Helm

Replace per-app `REDIS_HOST: redis-master` with Sentinel envs for Redis clients.

For all Redis-using apps:

```yaml
REDIS_MODE: sentinel
REDIS_SENTINELS: redis:26379
REDIS_SENTINEL_NAME: mymaster
REDIS_HOST: redis
REDIS_PORT: "6379"
REDIS_DB: "0"
```

Keep `REDIS_HOST` for compatibility or for tooling that still expects it, but
the app should use `REDIS_SENTINELS` in Sentinel mode.

Affected apps in Helm:

- `apps.auth-service.extraEnv`
- `apps.user-service.extraEnv`
- `apps.workspace-service.extraEnv`
- `apps.task-service.extraEnv`
- `apps.notification-service.extraEnv`

### 2.3 ConfigMap template improvement

`templates/apps/configmap.yaml` currently hard-codes `REDIS_PORT` and `REDIS_DB`
only for `notification-service`. Consider moving common Redis config into all
Redis-using apps or into `extraEnv` only.

Do not accidentally remove service-specific cache TTL envs.

### 2.4 Redis exporter

Current exporter uses:

```yaml
REDIS_ADDR=redis://:<password>@<redis-host>:6379
```

With Sentinel enabled, `infra.hosts.redis` should be `redis`, so this can still
point to `redis:6379`. Confirm that the Bitnami Sentinel service routes Redis
port `6379` to the current master. If exporter cannot follow failover reliably,
either:

- keep exporter pointed at `redis:6379` and accept brief scrape failures during
  failover, or
- deploy Redis exporter with Sentinel-aware configuration if supported by the
  exporter version.

Do not block the first migration on perfect exporter behavior.

### 2.5 Network policy

Update `allow-redis-clients`:

```yaml
metadata:
  name: allow-redis-clients
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: redis
  ingress:
    - from:
        - podSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - auth-service
                  - user-service
                  - workspace-service
                  - task-service
                  - notification-service
                  - redis-exporter
      ports:
        - port: 6379
          protocol: TCP
        - port: 26379
          protocol: TCP
```

If the Bitnami Redis Sentinel pod labels differ from current Redis labels after
rendering, adjust the selector based on `helm template` output.

### 2.6 Render verification

Render before touching prod:

```powershell
helm template collabspace infrastructure/helm/collabspace `
  -f infrastructure/helm/collabspace/values-prod.example.yaml `
  --set cloudnativepg.renderCluster=false `
  > $env:TEMP/collabspace-redis-sentinel.yaml
```

Check:

```powershell
Select-String -Path $env:TEMP/collabspace-redis-sentinel.yaml -Pattern "26379|REDIS_SENTINELS|REDIS_MODE|mymaster|redis-master|redis:"
```

Expected:

- `REDIS_MODE: sentinel`
- `REDIS_SENTINELS: redis:26379`
- `REDIS_SENTINEL_NAME: mymaster`
- No app still using `REDIS_HOST: redis-master` as the active path.
- Redis service exposes `6379` and `26379`.
- NetworkPolicy includes both ports and all Redis client services.

## Phase 3 - Staging/prod rollout

### 3.1 Maintenance window

Announce:

- OTP and cache may be invalidated.
- Users may need to request a new OTP or log in again.
- Expected impact should be short if rollback is ready.

### 3.2 Confirm app code with Sentinel support is already deployed

```powershell
kubectl get deploy -n collabspace -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image
```

Confirm all relevant images include Phase 1 code.

### 3.3 Helm upgrade

Use the real `values-prod.yaml` from ops, but do not commit or print it.

Recommended:

```powershell
helm upgrade --install collabspace infrastructure/helm/collabspace `
  --namespace collabspace `
  -f infrastructure/helm/collabspace/values-prod.yaml `
  --set cloudnativepg.renderCluster=false `
  --timeout 10m
```

If doing a live override without opening `values-prod.yaml`, use
`--reuse-values` and explicit `--set` values. Be careful: complex arrays and maps
are easier to get wrong with `--set`, so prefer values file for the final
migration.

### 3.4 Rollout watch

```powershell
kubectl get pods -n collabspace -w
```

In another shell:

```powershell
kubectl rollout status deployment/auth-service -n collabspace --timeout=300s
kubectl rollout status deployment/user-service -n collabspace --timeout=300s
kubectl rollout status deployment/workspace-service -n collabspace --timeout=300s
kubectl rollout status deployment/task-service -n collabspace --timeout=300s
kubectl rollout status deployment/notification-service -n collabspace --timeout=300s
kubectl rollout status statefulset/redis-master -n collabspace --timeout=300s
kubectl rollout status statefulset/redis-replicas -n collabspace --timeout=300s
```

StatefulSet names may differ. Confirm with:

```powershell
kubectl get statefulset -n collabspace | Select-String redis
```

### 3.5 Verify Sentinel

Find a Redis/Sentinel pod:

```powershell
kubectl get pods -n collabspace -l app.kubernetes.io/name=redis -o wide
```

Check service ports:

```powershell
kubectl get svc -n collabspace -l app.kubernetes.io/name=redis
kubectl describe svc redis -n collabspace
```

Check Sentinel master discovery:

```powershell
kubectl exec -n collabspace <redis-pod> -c sentinel -- `
  redis-cli -p 26379 -a '<password>' SENTINEL get-master-addr-by-name mymaster
```

Check Redis:

```powershell
kubectl exec -n collabspace <redis-pod> -c redis -- `
  redis-cli -a '<password>' ping
```

Expected:

```text
PONG
```

Do not paste the password into logs/chat.

### 3.6 Verify app health

```powershell
kubectl get deploy -n collabspace
kubectl get pods -n collabspace
```

External ready checks:

```powershell
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/auth/health/ready
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/users/health/ready
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/workspaces/health/ready
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/tasks/health/ready
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/notifications/health/ready
```

Expected: `200` for each.

### 3.7 Verify product flows

Minimum smoke:

- Register a user and receive/store OTP.
- Resend OTP.
- Verify email.
- Login.
- Read current user profile.
- Open workspace/task views that use membership and workspace caches.
- Read notification count/list.

Use existing smoke where possible:

```powershell
BASE_URL=https://collabspace.ngocanh2005it.site/api/v1 ./scripts/demo-e2e.sh
```

On Windows use the PowerShell equivalent if available.

## Phase 4 - Failover drill

Run only after all app health checks are green.

### 4.1 Identify current master

Via Sentinel:

```powershell
kubectl exec -n collabspace <redis-pod> -c sentinel -- `
  redis-cli -p 26379 -a '<password>' SENTINEL get-master-addr-by-name mymaster
```

Map returned IP to pod:

```powershell
kubectl get pods -n collabspace -l app.kubernetes.io/name=redis -o wide
```

### 4.2 Delete current master pod

```powershell
kubectl delete pod -n collabspace <current-master-pod>
```

Watch:

```powershell
kubectl get pods -n collabspace -l app.kubernetes.io/name=redis -w
```

Check Sentinel selects a new master:

```powershell
kubectl exec -n collabspace <remaining-redis-pod> -c sentinel -- `
  redis-cli -p 26379 -a '<password>' SENTINEL get-master-addr-by-name mymaster
```

### 4.3 Observe app behavior

Watch service logs for reconnects:

```powershell
kubectl logs -n collabspace deploy/auth-service --tail=80
kubectl logs -n collabspace deploy/notification-service --tail=80
kubectl logs -n collabspace deploy/task-service --tail=80
```

Expected:

- Brief Redis reconnect warnings are acceptable.
- `auth-service` should recover without restart.
- Caches may miss and repopulate.
- Notification pub/sub should reconnect or gracefully degrade.

Run health checks again:

```powershell
kubectl get deploy -n collabspace
curl -s -o NUL -w "%{http_code}`n" https://collabspace.ngocanh2005it.site/api/v1/auth/health/ready
```

### 4.4 Record drill result

Record:

- Timestamp.
- Redis master pod before/after.
- Failover duration.
- Any app errors.
- Whether OTP/login/notification flows recovered.
- Whether manual action was needed.

Suggested location:

- `infrastructure/resilience/drills/README.md`, or
- a dated file under `infrastructure/resilience/drills/`.

## Rollback plan

### Rollback Phase 1 app code

If app code breaks while Redis is still standalone:

```powershell
kubectl rollout undo deployment/auth-service -n collabspace
kubectl rollout undo deployment/user-service -n collabspace
kubectl rollout undo deployment/workspace-service -n collabspace
kubectl rollout undo deployment/task-service -n collabspace
kubectl rollout undo deployment/notification-service -n collabspace
```

### Rollback Phase 2 Redis topology

If Sentinel migration fails:

1. Set Redis values back to standalone:

```yaml
infra:
  hosts:
    redis: redis-master

redis:
  architecture: standalone
  sentinel:
    enabled: false
```

2. Set app env back:

```yaml
REDIS_MODE: standalone
REDIS_HOST: redis-master
REDIS_PORT: "6379"
```

3. Helm rollback or upgrade with known-good values:

```powershell
helm history collabspace -n collabspace
helm rollback collabspace <previous-good-revision> -n collabspace --timeout 10m
```

or:

```powershell
helm upgrade --install collabspace infrastructure/helm/collabspace `
  --namespace collabspace `
  -f infrastructure/helm/collabspace/values-prod.yaml `
  --set redis.architecture=standalone `
  --set redis.sentinel.enabled=false `
  --set infra.hosts.redis=redis-master `
  --timeout 10m
```

4. Restart app deployments if env did not roll:

```powershell
kubectl rollout restart deployment/auth-service -n collabspace
kubectl rollout restart deployment/user-service -n collabspace
kubectl rollout restart deployment/workspace-service -n collabspace
kubectl rollout restart deployment/task-service -n collabspace
kubectl rollout restart deployment/notification-service -n collabspace
```

Expected rollback impact:

- Redis transient data may be lost.
- Users may need new OTP/login.
- Persistent PostgreSQL/Mongo data is not affected.

## Documentation and skills sync required

This migration changes env/config contracts and operational behavior, so update
these in the same PR as implementation:

- `.claude/docs/project-architecture.md`: Redis topology.
- `.claude/docs/service-contracts.md`: Redis env contract if env variables are
  documented there.
- `.claude/docs/development-workflows.md`: local standalone vs prod Sentinel.
- `.claude/docs/doks-operations.md`: Redis Sentinel operations/failover commands.
- `docs/observability.md`: Redis exporter/Sentinel monitoring notes.
- `docs/runbooks/RedisDown.md`: Sentinel-aware recovery steps.
- `docs/team/phan-phu-tho-infrastructure-backlog.md`: Redis operations status.
- `infrastructure/helm/README.md`: Redis Sentinel values.
- `.agents/skills/local-dev-verify/SKILL.md` and `.agents/skills/collabspace-codebase/SKILL.md`
  after syncing from `.claude/skills/`, if the corresponding `.claude/skills`
  are updated.

After editing `.claude/skills/`, run:

```powershell
pwsh scripts/sync-agent-docs.ps1
```

or:

```bash
bash scripts/sync-agent-docs.sh
```

## Implementation checklist

### Code

- [x] Add Sentinel config parsing to `auth-service`.
- [x] Add Sentinel config parsing to `user-service`.
- [x] Add Sentinel config parsing to `workspace-service`.
- [x] Add Sentinel config parsing to `task-service`.
- [x] Add Sentinel config parsing to `notification-service`.
- [x] Ensure `REDIS_MODE=sentinel` ignores `REDIS_URL`.
- [x] Ensure `redis.duplicate()` in notification realtime works with Sentinel.
- [ ] Add unit tests for standalone and Sentinel modes.

### Helm

- [x] Change Redis to `architecture: replication`.
- [x] Enable `redis.sentinel.enabled`.
- [x] Set `redis.sentinel.masterSet=mymaster`.
- [x] Set `redis.sentinel.quorum=2`.
- [x] Set `redis.replica.replicaCount=2`.
- [x] Set small but explicit Redis/Sentinel resources.
- [x] Change `infra.hosts.redis` from `redis-master` to `redis` for Sentinel.
- [x] Add app envs `REDIS_MODE`, `REDIS_SENTINELS`, `REDIS_SENTINEL_NAME`.
- [x] Update network policy to allow Redis clients on `6379` and `26379`.
- [x] Confirm Redis exporter still works or document scrape limitation.

### Verification

- [x] `helm template` passes.
- [ ] `pnpm run lint` passes.
- [ ] `pnpm run build` passes.
- [ ] `pnpm run test` passes.
- [x] DOKS rollout completes.
- [x] All app health endpoints return `200`.
- [x] Redis Sentinel returns current master for `mymaster`.
- [ ] Redis master pod delete triggers failover. _(Phase 4 drill — pending)_
- [ ] Auth OTP/login still works after failover. _(Phase 4 drill — pending)_
- [ ] Notification cache/realtime does not crash after failover. _(Phase 4 drill — pending)_
- [ ] Runbook/drill result recorded. _(Phase 4 drill — pending)_

## Open questions before implementation

1. Should prod accept Redis data loss during the migration window?
   - Recommended answer for current CollabSpace: yes.
2. Do we want Sentinel enabled only in prod/DOKS while local stays standalone?
   - Recommended answer: yes.
3. Should `task-service` and `workspace-service` Redis access be officially
   documented as production dependencies?
   - Recommended answer: yes, because Helm already configures `REDIS_HOST`.
4. Should we install `metrics-server` first?
   - Current answer: already done. Keep `infrastructure/k8s/metrics-server.yaml`
   as the reviewed manifest and use `kubectl top` for live usage snapshots.
5. Should we add a fourth DOKS node before or after Sentinel?
   - Recommended answer: not needed for now. The new cluster (3 × `s-4vcpu-8gb`)
   has sufficient headroom for Sentinel. Revisit only if CPU requests exceed 75%
   on any node after rollout, or if production HA/SLO expectations increase.
