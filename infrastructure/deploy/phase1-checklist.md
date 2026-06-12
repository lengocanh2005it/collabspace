# Phase 1 — Checklist bootstrap k3s

Hoàn thành sau Phase 0. Lộ trình: [docs/deployment-k3s-phases.md](../../docs/deployment-k3s-phases.md).

## Trên Droplet (SSH root)

### Cách A — Script từ repo (khuyến nghị)

```bash
# Clone nếu chưa có
git clone https://github.com/<owner>/collabspace.git /opt/collabspace
cd /opt/collabspace
chmod +x infrastructure/deploy/k3s-bootstrap.sh
sudo bash infrastructure/deploy/k3s-bootstrap.sh
```

### Cách B — One-liner (clone + bootstrap)

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/collabspace/main/infrastructure/deploy/k3s-bootstrap.sh \
  | sudo bash -s -- https://github.com/<owner>/collabspace.git
```

Script sẽ:

1. Cài `curl`, `git`, `jq`, `ufw`
2. Mở firewall `22`, `80`, `443`
3. Cài **k3s** với `--disable traefik`
4. Tạo namespace `collabspace`
5. Cài **Helm 3.16+**
6. Chạy `helm dependency update` cho chart CollabSpace

## Kiểm tra trên Droplet

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes          # STATUS Ready
kubectl get ns collabspace
kubectl get storageclass   # local-path (default)
bash /opt/collabspace/infrastructure/deploy/verify-phase1.sh
```

- [ ] Node `Ready`
- [ ] Namespace `collabspace` tồn tại
- [ ] Có StorageClass (k3s `local-path`)
- [ ] `helm dependency update` thành công (`infrastructure/helm/collabspace/charts/` có file)
- [ ] **Không** có Traefik system pod từ k3s (Traefik sẽ do Helm chart cài ở Phase 3)

## Kubeconfig trên máy local (tùy chọn)

```bash
# Linux/macOS
chmod +x infrastructure/deploy/fetch-kubeconfig.sh
./infrastructure/deploy/fetch-kubeconfig.sh <DROPLET_IP>

# Windows
.\infrastructure\deploy\fetch-kubeconfig.ps1 -DropletHost <DROPLET_IP>
```

- [ ] `kubectl get nodes` từ laptop thành công

## Lưu ý

| Mục | Chi tiết |
|-----|----------|
| RAM | Droplet 8 GiB — chưa deploy app ở Phase 1; chỉ cluster |
| Docker | **Không bắt buộc** cho k3s runtime (containerd). Compose legacy mới cần Docker. |
| K8s API `6443` | Không public ra internet; dùng SSH tunnel hoặc kubeconfig qua SCP |

## Troubleshooting

| Triệu chứng | Gợi ý |
|-------------|--------|
| `kubectl` connection refused | `systemctl status k3s`; đợi 1–2 phút sau install |
| `helm dependency update` lỗi OCI | Kiểm tra outbound HTTPS; retry |
| Node NotReady | `journalctl -u k3s -e`; kiểm tra disk/RAM |

**Xong Phase 1 →** [Phase 2 checklist](./phase2-checklist.md)
