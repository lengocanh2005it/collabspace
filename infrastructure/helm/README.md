# CollabSpace Helm Deployment

Kubernetes deployment for CollabSpace using an **umbrella Helm chart** with Bitnami data-store subcharts and Traefik as the API gateway.

## Chart layout

```text
infrastructure/helm/
├── README.md
├── scripts/
│   ├── install.sh
│   └── install.ps1
└── collabspace/
    ├── Chart.yaml          # dependencies: postgresql, mongodb, redis, traefik
    ├── values.yaml         # default (production-like)
    ├── values-local.yaml   # minikube/kind — fewer replicas, NodePort
    └── templates/
        ├── apps/           # microservice Deployments, Services, HPA, PDB
        ├── gateway/        # Traefik IngressRoute + Middleware
        ├── observability/  # Prometheus, Grafana dashboards CM, exporters, alertmanager
        └── network-policies.yaml
```

## Prerequisites

- Kubernetes **1.24+**
- **Helm 3.12+**
- `kubectl` configured for your cluster
- Storage class for PVCs (Bitnami PostgreSQL, MongoDB, Redis)
- Container images built and available to the cluster (`collabspace/*:latest`)

### Install Helm (if missing)

```bash
# Windows (winget)
winget install Helm.Helm

# macOS
brew install helm
```

## Quick start (local cluster)

```bash
# From repository root
./infrastructure/helm/scripts/install.sh --local

# Windows PowerShell
./infrastructure/helm/scripts/install.ps1 -Local
```

Manual steps:

```bash
cd infrastructure/helm/collabspace

# Fetch subchart dependencies (Bitnami OCI + Traefik)
helm dependency update

# Install into collabspace namespace
helm upgrade --install collabspace . \
  --namespace collabspace \
  --create-namespace \
  -f values.yaml \
  -f values-local.yaml

kubectl get pods -n collabspace
kubectl get svc traefik -n collabspace
```

## Production overrides

**Lộ trình deploy production (DigitalOcean k3s):** [docs/deployment-k3s-phases.md](../../docs/deployment-k3s-phases.md) (Phase 0–4 + observability).  
**Observability (Grafana/Loki/k6):** [docs/observability.md](../../docs/observability.md).

```bash
cp infrastructure/deploy/phase0.env.example infrastructure/deploy/phase0.env
# edit phase0.env, then:
./infrastructure/deploy/prepare-prod-values.sh
```

Mẫu commit-safe: `values-prod.example.yaml`. File `values-prod.yaml` thật **không** commit (gitignored).

**With HashiCorp Vault + External Secrets Operator** (recommended): see `infrastructure/vault/README.md`. Set `global.externalSecrets.enabled: true` so Helm does not render `{app}-secrets` (ESO syncs from Vault).

**Without ESO** (CI injects Helm values only):

```yaml
global:
  secrets:
    jwtSecret: "<from-secret-manager>"
    serviceJwtSecret: "<shared-service-jwt-secret>"
    postgresPassword: "<strong-password>"
    mongoPassword: "<strong-password>"
    redisPassword: "<strong-password>"
    metricsAuthToken: "<prometheus-scrape-token>"

apps:
  auth-service:
    image:
      tag: "v1.2.3"
```

```bash
helm upgrade --install collabspace . \
  -n collabspace \
  -f values.yaml \
  -f values-prod.yaml \
  --set global.secrets.jwtSecret="$JWT_SECRET"
```

## What the chart deploys

| Layer | Source | Notes |
|-------|--------|-------|
| PostgreSQL | Bitnami subchart | DBs: `collabspace_auth`, `collabspace_user`, `collabspace_workspace` |
| MongoDB | Bitnami subchart | DBs: `collabspace_task`, `collabspace_notification` |
| Redis | Bitnami subchart | Auth sessions + notification cache |

Cross-service events use **Kafka + Debezium** (outbox CDC) — not deployed by this chart; see `infrastructure/kafka/README.md` and `docs/kafka-debezium-migration-roadmap.md`.

| Traefik | Official Traefik chart | LoadBalancer / NodePort gateway |
| Apps | Custom templates | auth, user, workspace (8080), task, notification |
| Gateway routes | IngressRoute CRDs | Forward-auth via auth-service |
| Observability | Helm subcharts + templates | Prometheus, Grafana (`/grafana`), Loki, Promtail; dashboards in `dashboards/` |

## Service hostnames (in-cluster)

Subcharts use `fullnameOverride` so application env vars match Docker Compose:

| Service | Hostname | Port |
|---------|----------|------|
| PostgreSQL | `postgres` | 5432 |
| MongoDB | `mongo` | 27017 |
| Redis | `redis` | 6379 |
| workspace-service | `workspace-service` | **8080** |

## Legacy plain YAML

Flat manifests under `infrastructure/k8s/` are kept for reference. **Use Helm for new deployments.**

## Uninstall

```bash
helm uninstall collabspace -n collabspace
# PVCs from Bitnami subcharts may remain — delete manually if needed
kubectl delete pvc -n collabspace --all
```

## Troubleshooting

| Issue | Check |
|-------|-------|
| `helm dependency update` fails | Docker Hub / OCI access; retry or use VPN |
| Pods `ImagePullBackOff` | Build/push images or set `values-local.yaml` `imagePullPolicy` |
| IngressRoute not routing | `kubectl get ingressroute -n collabspace`; Traefik CRDs installed |
| workspace 502 | Service port must be **8080**, not 3000 |
| Mongo auth errors | Align `global.secrets.mongoPassword` with `mongodb.auth.rootPassword` |
## Grafana & observability (K8s)

Public URL (when `gateway.grafana.expose: true`): `http://<LOAD_BALANCER_IP>/grafana/`

## Swagger UI (K8s gateway)

Public URLs (when `gateway.swagger.expose: true`):

| Service | URL |
|---------|-----|
| auth-service | `http://<HOST>/swagger/auth` |
| user-service | `http://<HOST>/swagger/user` |
| workspace-service | `http://<HOST>/swagger/workspace` |
| task-service | `http://<HOST>/swagger/task` |
| notification-service | `http://<HOST>/swagger/notification` |

Helm sets `SWAGGER_UI_PATH` per app ConfigMap; IngressRoute `collabspace-swagger` forwards without JWT (public docs). OpenAPI includes request/response schemas (`@ApiOkResponse`). Full URL index: [docs/service-urls.md](../../docs/service-urls.md).

Provisioned dashboards (folder **CollabSpace**): Service Health, App Logs, Load Test Run.  
Full guide: [docs/observability.md](../../docs/observability.md).

| Issue | Check |
|-------|-------|
| Grafana 404 | `kubectl get ingressroute -n collabspace`; NetworkPolicy `allow-traefik-to-grafana` |
| Dashboard empty | Prometheus targets; `metricsAuthToken` + `prometheus-metrics-auth` secret |
| No app targets in Prometheus | Pod must use `serviceAccountName: prometheus` (not `default`) |
| Logs noisy (exporter/canary) | Use **App Logs** dashboard (5 apps only); disable `loki.lokiCanary` |
| Prometheus 401 on `/metrics` | Scrape Bearer token must match `metricsAuthToken` |
