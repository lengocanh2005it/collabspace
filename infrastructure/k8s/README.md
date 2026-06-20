# Legacy Kubernetes Manifests

> **DEPRECATED — do not use for new deployments.** These plain YAML files predate the Helm chart and contain unsafe defaults (`DATABASE_SYNCHRONIZE=true` in workspace deployment, hardcoded passwords in exporters). Use Helm + Vault/ESO instead.

These plain YAML files were the original CollabSpace K8s deployment (Agent BRAVO).

**Preferred deployment path:** [Helm chart](../helm/README.md) — includes Prometheus, Grafana (`/grafana`), Loki, Promtail ([docs/observability.md](../../docs/observability.md)).

```bash
./infrastructure/helm/scripts/install.sh
```

## Why Helm now?

- Bitnami subcharts for PostgreSQL, MongoDB, Redis; Kafka + Debezium via `infrastructure/kafka/` (upgrades, persistence, auth)
- Official Traefik chart for the API gateway
- Single `values.yaml` for environments (local vs production)
- Templated microservices with shared secrets and connection strings
- **HashiCorp Vault + ESO:** `infrastructure/vault/k8s/` — set `global.externalSecrets.enabled: true` in Helm values

## Using legacy YAML (reference only)

**Warning:** `workspace-deployment.yaml` sets `DATABASE_SYNCHRONIZE: "true"` — never use in production. `exporters-deployment.yaml` embeds demo credentials (`postgres:postgres`, `admin:password`) — replace before any real cluster.

```bash
kubectl apply -f infrastructure/k8s/
```

Network policies (`network-policies.yaml`) enforce Phase B4 trust boundaries when your CNI supports `NetworkPolicy`. Internal HTTP APIs are reachable only from authorized pods (e.g. task-service → workspace-service), not from Traefik.

Note: legacy manifests use custom StatefulSets instead of Bitnami charts and may drift from `services/*/.env.example`.
