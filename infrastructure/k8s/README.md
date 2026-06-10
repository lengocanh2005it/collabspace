# Legacy Kubernetes Manifests

These plain YAML files were the original CollabSpace K8s deployment (Agent BRAVO).

**Preferred deployment path:** [Helm chart](../helm/README.md)

```bash
./infrastructure/helm/scripts/install.sh
```

## Why Helm now?

- Bitnami subcharts for PostgreSQL, MongoDB, Redis, RabbitMQ (upgrades, persistence, auth)
- Official Traefik chart for the API gateway
- Single `values.yaml` for environments (local vs production)
- Templated microservices with shared secrets and connection strings

## Using legacy YAML (reference only)

```bash
kubectl apply -f infrastructure/k8s/
```

Network policies (`network-policies.yaml`) enforce Phase B4 trust boundaries when your CNI supports `NetworkPolicy`. Internal HTTP APIs are reachable only from authorized pods (e.g. task-service → workspace-service), not from Traefik.

Note: legacy manifests use custom StatefulSets instead of Bitnami charts and may drift from `services/*/.env.example`.
