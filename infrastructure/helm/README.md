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
    ├── Chart.yaml          # dependencies: postgresql, mongodb, redis, rabbitmq, traefik
    ├── values.yaml         # default (production-like)
    ├── values-local.yaml   # minikube/kind — fewer replicas, NodePort
    └── templates/
        ├── apps/           # microservice Deployments, Services, HPA, PDB
        ├── gateway/        # Traefik IngressRoute + Middleware
        ├── observability/  # Prometheus + redis-exporter
        └── network-policies.yaml
```

## Prerequisites

- Kubernetes **1.24+**
- **Helm 3.12+**
- `kubectl` configured for your cluster
- Storage class for PVCs (Bitnami PostgreSQL, MongoDB, Redis, RabbitMQ)
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

Create `values-prod.yaml` (do **not** commit secrets):

```yaml
global:
  secrets:
    jwtSecret: "<from-secret-manager>"
    postgresPassword: "<strong-password>"
    mongoPassword: "<strong-password>"
    redisPassword: "<strong-password>"
    rabbitmqPassword: "<strong-password>"
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
| RabbitMQ | Bitnami subchart | Vhost `collabspace` |
| Traefik | Official Traefik chart | LoadBalancer / NodePort gateway |
| Apps | Custom templates | auth, user, workspace (8080), task, notification |
| Gateway routes | IngressRoute CRDs | Forward-auth via auth-service |
| Observability | Optional Prometheus | Disabled in `values-local.yaml` |

## Service hostnames (in-cluster)

Subcharts use `fullnameOverride` so application env vars match Docker Compose:

| Service | Hostname | Port |
|---------|----------|------|
| PostgreSQL | `postgres` | 5432 |
| MongoDB | `mongo` | 27017 |
| Redis | `redis` | 6379 |
| RabbitMQ | `rabbitmq` | 5672 |
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
| Prometheus 401 on `/metrics` | Set scrape `bearer_token` or header `X-Metrics-Token` to match `metricsAuthToken` |
