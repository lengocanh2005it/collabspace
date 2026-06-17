# Vault HA & Kubernetes Auth Runbook

This document describes the 3000% Extreme Product-Level architecture for running HashiCorp Vault in High Availability (HA) mode within Kubernetes, and authenticating workloads seamlessly without static tokens.

## 1. Vault High Availability (HA) Architecture
By default, the development environment runs Vault in standalone mode. For production/staging parity:
1. **Storage Backend**: We use **Consul** as the storage backend to provide distributed locking and HA state.
2. **Replicas**: Vault runs as a StatefulSet with 3 replicas.
3. **Auto-Unseal**: We utilize a cloud KMS (AWS KMS, Google Cloud KMS, or Azure Key Vault) to perform auto-unseal. Local Dev HA uses a static key for Transit auto-unseal to avoid KMS dependency.

### HA Helm Configuration Example
```yaml
server:
  ha:
    enabled: true
    replicas: 3
    config: |
      ui = true
      listener "tcp" {
        tls_disable = 1
        address = "[::]:8200"
        cluster_address = "[::]:8201"
      }
      storage "consul" {
        path = "vault"
        address = "HOST_IP:8500"
      }
```

## 2. Kubernetes Authentication Method
Instead of passing root or long-lived static tokens to the External Secrets Operator (ESO), we use the **Vault Kubernetes Auth Method**.

### How it Works
1. ESO uses its own Kubernetes `ServiceAccount`.
2. Vault is configured to trust the Kubernetes API server.
3. ESO requests a Vault token by sending its Kubernetes JWT token to Vault's `/v1/auth/kubernetes/login` endpoint.
4. Vault verifies the JWT signature with the K8s API.
5. Vault issues a short-lived token bound to the `collabspace-eso-policy`.

### Vault Setup Commands
```bash
# Enable K8s Auth
vault auth enable kubernetes

# Configure Vault to talk to K8s API
vault write auth/kubernetes/config \
    kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443"

# Create a policy for ESO
vault policy write collabspace-eso-policy - <<EOF
path "secret/data/collabspace/*" {
  capabilities = ["read", "list"]
}
EOF

# Bind the ServiceAccount to the Role and Policy
vault write auth/kubernetes/role/eso-role \
    bound_service_account_names=external-secrets \
    bound_service_account_namespaces=external-secrets \
    policies=collabspace-eso-policy \
    ttl=1h
```

With this architecture, there are zero static credentials in the CI/CD pipeline or deployment artifacts.
