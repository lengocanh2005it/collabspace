# Phase 2 — Checklist Vault + External Secrets Operator

Sau Phase 1. Cần `phase0.env` đã điền (cùng secret sẽ vào Vault `secret/collabspace/prod`).

Lộ trình: [docs/deployment-k3s-phases.md](../../docs/deployment-k3s-phases.md).

## Trước khi chạy

- [ ] Phase 1 xong (`verify-phase1.sh` pass)
- [ ] File `infrastructure/deploy/phase0.env` có đủ secret (gitignored)
- [ ] (Khuyến nghị) `values-prod.yaml` đã tạo — password **khớp** `phase0.env`

## Chạy trên Droplet

```bash
cd /opt/collabspace
git pull --ff-only
chmod +x infrastructure/deploy/vault-eso-phase2.sh infrastructure/deploy/verify-phase2.sh
sudo bash infrastructure/deploy/vault-eso-phase2.sh
```

Script sẽ:

1. Cài **External Secrets Operator** (Helm, namespace `external-secrets`)
2. Cài **HashiCorp Vault** standalone + PVC (namespace `vault`)
3. **Init / unseal** Vault — lưu `infrastructure/vault/.vault-k3s-init.json` (gitignored)
4. Enable KV v2 `secret/`, policy `collabspace-prod-read`, token ESO
5. **Seed** `secret/collabspace/prod` từ `phase0.env`
6. Tạo Secret `vault-eso-token` trong `collabspace`
7. Apply `cluster-secret-store.yaml` + `external-secrets.prod.yaml`

## Kiểm tra

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get pods -n vault
kubectl get pods -n external-secrets
kubectl get externalsecrets -n collabspace
kubectl get secrets -n collabspace | grep -E 'auth|user|workspace|task|notification'

sudo bash infrastructure/deploy/verify-phase2.sh
```

- [ ] Vault pod `vault-0` Running, **unsealed**
- [ ] ESO pods Running
- [ ] 5 ExternalSecret trạng thái `SecretSynced`
- [ ] 5 Secret `{service}-secrets` tồn tại trong `collabspace`

## Backup quan trọng (làm ngay)

| File | Nội dung | Lưu ở đâu |
|------|----------|-----------|
| `.vault-k3s-init.json` | Unseal key + root token | Password manager / ngoài Droplet |
| `.vault-k3s-eso-token.json` | Token ESO read-only | Có thể tạo lại từ root nếu mất |

**Không** commit các file trên lên Git.

## Seed lại thủ công

```bash
cd /opt/collabspace
bash infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh
```

## Troubleshooting

| Triệu chứng | Gợi ý |
|-------------|--------|
| ExternalSecret `SecretSyncedError` | `kubectl describe externalsecret -n collabspace`; kiểm tra Vault path `collabspace/prod` |
| Vault sealed sau reboot | `vault operator unseal` với key từ `.vault-k3s-init.json` |
| ESO không kết nối Vault | `kubectl get clustersecretstore vault-collabspace -o yaml` |
| Permission denied Vault | Token ESO có policy `collabspace-prod-read` |

## Nâng cấp sau (không bắt buộc Phase 2)

- Vault **Kubernetes auth** thay token dài hạn — [Vault K8s auth](https://developer.hashicorp.com/vault/docs/auth/kubernetes)
- Vault HA / HCP Vault

**Xong Phase 2 →** [Phase 3: Deploy ứng dụng](../../docs/deployment-k3s-phases.md#phase-3--deploy-ứng-dụng-helm)
