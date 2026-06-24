# Legacy Kubernetes Manifests — Dev Reference Only

> **DEPRECATED — do not use for production or new deployments.** These plain YAML files predate the Helm chart and may drift from current Helm/Vault/ESO deployment conventions. They now use explicit `REPLACE_ME` placeholders for secrets and exporter credentials, but production runs on DOKS via Helm + Vault/ESO only.

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

**Warning:** these manifests are reference-only. Replace every `REPLACE_ME` value, create the referenced exporter credential Secret, and review `services.yaml` against current HTTP/gRPC ports before any non-local test cluster.

```bash
kubectl apply -f infrastructure/k8s/
```

Network policies (`network-policies.yaml`) enforce Phase B4 trust boundaries when your CNI supports `NetworkPolicy`. Internal HTTP APIs are reachable only from authorized pods (e.g. task-service → workspace-service), not from Traefik.

Note: legacy manifests use custom StatefulSets instead of Bitnami charts and may drift from `services/*/.env.example`.
