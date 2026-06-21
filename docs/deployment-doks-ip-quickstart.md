# Quickstart — Deploy Droplet bằng IP (không domain)

Hướng dẫn chạy **Phase 0 → 3** gần như một lần, API tại `http://<IP>/api/v1`.

Lộ trình đầy đủ: [deployment-k3s-phases.md](./deployment-k3s-phases.md).

---

## Bạn cần chuẩn bị

| Hạng mục | Chi tiết |
|----------|----------|
| Droplet | Ubuntu 24.04, **4 vCPU / 8 GiB RAM**, SSH key |
| Máy local | Windows (PowerShell) hoặc Linux — có `ssh`, `scp`, `git` |
| GHCR | Image 5 service đã build trên `main` (workflow **Build Images And Deploy**) |
| Thời gian | ~45–90 phút lần đầu |

**Không cần:** domain, DNS, TLS (Phase 5 sau).

---

## Cách nhanh nhất (một script từ Windows)

```powershell
cd E:\collabspace

# Thay IP và đường dẫn SSH key
.\infrastructure\deploy\deploy-doks-from-local.ps1 `
  -DropletIp 165.xxx.xxx.xxx `
  -SshKeyPath "$env:USERPROFILE\.ssh\id_ed25519"
```

Script sẽ:

1. Sinh `phase0.env` (secret ngẫu nhiên, `PROD_DOMAIN` = IP)
2. Tạo `values-prod.yaml`
3. SSH → cài k3s (Phase 1)
4. Upload `phase0.env` + `values-prod.yaml`
5. SSH → Vault + ESO (Phase 2) → Helm deploy (Phase 3)

---

## Từng bước (nếu muốn kiểm soát)

### Phase 0 — Trên máy local

```powershell
.\infrastructure\deploy\generate-phase0-secrets.ps1 -DropletIp 165.xxx.xxx.xxx
.\infrastructure\deploy\prepare-prod-values.ps1
```

Kiểm tra `IMAGE_TAG` trong `phase0.env` **khớp** commit SHA đã build trên GHCR (`git rev-parse origin/main`).

Repo **private** — dùng **một PAT** (classic: `repo` + `read:packages`):

```env
GHCR_USERNAME=lengocanh2005it
GHCR_TOKEN=ghp_...
# GITHUB_TOKEN=   # tùy chọn; để trống thì dùng GHCR_TOKEN để clone/pull trên Droplet
```

Script `git-sync-private-repo.sh` clone/pull qua `x-access-token` (không lưu token trong URL remote).

### Phase 1 — Trên Droplet

```bash
ssh root@165.xxx.xxx.xxx
git clone -b main https://github.com/lengocanh2005it/collabspace.git /opt/collabspace
cd /opt/collabspace
sudo bash infrastructure/deploy/k3s-bootstrap.sh
sudo bash infrastructure/deploy/verify-phase1.sh
```

### Upload config — Từ máy local

```powershell
.\infrastructure\deploy\upload-prod-config-to-doks.ps1 `
  -DropletIp 165.xxx.xxx.xxx `
  -SshKeyPath "$env:USERPROFILE\.ssh\id_ed25519"
```

### Phase 2–3 — Trên Droplet

```bash
ssh root@165.xxx.xxx.xxx
cd /opt/collabspace
sudo bash infrastructure/deploy/run-phases-2-3-on-doks.sh
```

**Quan trọng:** backup file Vault ngay sau Phase 2:

```bash
# Trên laptop
scp root@165.xxx.xxx.xxx:/opt/collabspace/infrastructure/vault/.vault-k3s-init.json .
```

### Kiểm tra API

```bash
curl -fsS http://165.xxx.xxx.xxx/api/v1/auth/health/ready
curl -fsS http://165.xxx.xxx.xxx/api/v1/users/health/ready
```

Smoke MVP (cần stack + Brevo email hoặc OTP outbox fallback cho bước register):

```bash
BASE_URL=http://165.xxx.xxx.xxx/api/v1 ./scripts/demo-e2e.sh
```

---

## Phase 4 — CI/CD (sau khi Phase 3 xong)

1. **GitHub Secrets** (repo → Settings → Secrets):

   | Secret | Giá trị |
   |--------|---------|
   | `DROPLET_HOST` | IP Droplet |
   | `DROPLET_USER` | `root` |
   | `DROPLET_SSH_KEY` | Nội dung file private key |
   | `GHCR_USERNAME` / `GHCR_TOKEN` | Nếu image private |

2. **Merge** `lna_dev` → `main` (workflow deploy chỉ trigger trên `main`).

3. Push `main` → Actions job `deploy` chạy `helm-deploy-ci.sh`.

Chi tiết: [deployment-k3s-phases.md](./deployment-k3s-phases.md) (Phase 4 — CI/CD).

---

## Troubleshooting

| Vấn đề | Gợi ý |
|--------|--------|
| `ImagePullBackOff` | Tag sai; package private thiếu `GHCR_TOKEN`; hoặc bỏ `imagePullSecrets` nếu public |
| SSH refused | Firewall DO mở port 22; đúng SSH key |
| Vault sealed sau reboot | `vault operator unseal` với key trong `.vault-k3s-init.json` |
| CORS từ frontend (`localhost:5173` → prod API) | Thêm `http://localhost:5173` vào `gateway.cors.allowOrigins` (hoặc `*`). **Route có `forward-auth`:** middleware `cors-headers` phải đứng **trước** `forward-auth` — nếu không, OPTIONS preflight trả `401` không có header CORS. Kiểm tra: `curl -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET" https://<domain>/api/v1/auth/me -D -` phải thấy `Access-Control-Allow-Origin`. |
| HTTPS không chạy | Bình thường khi chỉ dùng IP — dùng `http://` |

---

## Giới hạn IP-only

- Không có Let's Encrypt (cần domain ở Phase 5).
- Một số client/browser có thể cảnh báo khi gửi cookie qua HTTP — chấp nhận được cho demo.
- `PROD_DOMAIN` = IP chỉ dùng cho CORS (`http://<IP>`).
