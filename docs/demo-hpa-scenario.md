# Demo Kịch Bản: HPA Auto-Scaling + Slack Alert

**Tổng thời gian:** ~8-10 phút  
**Mục tiêu:** Chứng minh hệ thống tự động scale từ 2 → 3 replicas khi tải tăng, và tự động gửi cảnh báo vào Slack.

---

## Chuẩn bị trước khi demo (không làm trước mặt người xem)

1. **Chờ HPA về 2 replicas** (sau load test trước cần ~5 phút không có traffic):
   ```bash
   kubectl get hpa -n collabspace
   # Đảm bảo cột REPLICAS = 2 cho tất cả service
   ```

2. **Mở sẵn 3 cửa sổ/tab:**
   - Terminal 1: chạy lệnh watch HPA
   - Terminal 2: chạy k6 job
   - Browser tab 1: Grafana dashboard — `https://collabspace.ngocanh2005it.site/grafana`
   - Browser tab 2: Slack `#nouveau-canal`

3. **Đăng nhập Grafana trước**, mở sẵn dashboard **"CollabSpace Load Test"**.

---

## Kịch bản demo từng bước

---

### Cảnh 1 — Hệ thống đang ổn định (1-2 phút)

**Thao tác:**
```bash
# Terminal 1 — chạy lệnh này, để màn hình hiện ra trước mặt người xem
kubectl get hpa -n collabspace -w
```

**Nói miệng:**
> "Đây là trạng thái bình thường của hệ thống. Mỗi service đang chạy **2 replicas** — đây là số tối thiểu mình cấu hình trong HPA. CPU đang thấp, hệ thống idle."

> "Mình có **5 core service** đều được bọc bởi HPA: auth, user, workspace, task, và notification. Mỗi cái được phép scale từ 2 lên tối đa 3 replicas khi CPU vượt ngưỡng 70%."

**Màn hình cần hiện:**
```
NAME                       REFERENCE                         TARGETS        MINPODS   MAXPODS   REPLICAS
auth-service-hpa           Deployment/auth-service           cpu: 12%/70%   2         3         2
notification-service-hpa   Deployment/notification-service   cpu: 8%/70%    2         3         2
task-service-hpa           Deployment/task-service           cpu: 10%/70%   2         3         2
user-service-hpa           Deployment/user-service           cpu: 5%/70%    2         3         2
workspace-service-hpa      Deployment/workspace-service      cpu: 9%/70%    2         3         2
```

---

### Cảnh 2 — Bắn load test (30 giây đầu)

**Thao tác (Terminal 2):**
```bash
# Xóa job cũ nếu còn
kubectl delete job k6-load-test -n collabspace --ignore-not-found=true

# Chạy load test với 50 VUs
sed -e 's/value: "smoke"/value: "demo-flow"/' \
    -e 's/value: "10"/value: "50"/' \
    infrastructure/load-testing/k6-job.yaml | kubectl apply -f -
```

**Nói miệng (trong lúc apply):**
> "Bây giờ mình simulate một đợt traffic lớn — 50 virtual users cùng lúc liên tục gọi API. Đây là kịch bản giả lập giờ cao điểm người dùng đổ vào hệ thống."

**Theo dõi k6 khởi động:**
```bash
kubectl logs -f -l app=k6-load-test -n collabspace
```

**Nói miệng (khi thấy log `running (0m05s), 50/50 VUs`):**
> "Load test đã bắt đầu — 50 VUs đang bắn request vào các endpoint: workspaces, tasks, notifications, health check. Tốc độ khoảng 80-100 request/giây."

---

### Cảnh 3 — CPU tăng, HPA bắt đầu scale (30-60 giây sau)

**Thao tác:** Chuyển về Terminal 1 (đang chạy `kubectl get hpa -w`).

**Chờ và quan sát** — màn hình tự cập nhật khi CPU vượt 70%:
```
auth-service-hpa    Deployment/auth-service    cpu: 438%/70%    2    3    3    ← REPLICAS đổi từ 2 → 3
workspace-service-hpa ...                      cpu: 238%/70%    2    3    3
task-service-hpa    ...                        cpu: 160%/70%    2    3    3
```

**Nói miệng (khi thấy REPLICAS đổi thành 3):**
> "Đây rồi! HPA vừa phát hiện CPU của **auth-service** vọt lên **438%** — vượt ngưỡng 70% rất nhiều. Kubernetes tự động quyết định scale từ 2 lên **3 replicas** để phân tải."

> "Chú ý là không cần can thiệp gì — hoàn toàn tự động. Kubernetes metrics server đọc CPU liên tục mỗi 15 giây và HPA phản ứng ngay khi phát hiện ngưỡng bị vượt."

---

### Cảnh 4 — Xem Grafana dashboard (song song)

**Thao tác:** Chuyển sang browser tab Grafana, mở dashboard **"CollabSpace Load Test"**.

**Nói miệng:**
> "Bên Grafana mình thấy biểu đồ realtime: request rate tăng đột biến, response time p95 đang ở khoảng 1-1.5 giây. Đây là dữ liệu từ k6 đẩy thẳng vào Prometheus."

> "Dashboard này hiện đầy đủ: số VUs đang chạy, tỉ lệ request thành công, phân phối latency. Các bạn có thể thấy hệ thống đang chịu tải nặng nhưng vẫn phục vụ được."

**Nếu muốn xem thêm:** Mở dashboard **"CollabSpace Service Health"** để thấy CPU spike của từng service theo thời gian thực.

---

### Cảnh 5 — Slack nhận cảnh báo tự động (~60-90 giây sau khi scale)

**Thao tác:** Chuyển sang tab Slack `#nouveau-canal`.

**Chờ alert xuất hiện** (khoảng 60-90 giây sau khi HPA scale):

```
[FIRING:5] HPAScaledUp notification-service-hpa auth-service-hpa ...

Alert: HPA auth-service-hpa đã scale lên max replicas - warning
Description: auth-service-hpa đang chạy 3 replicas (max=3). CPU liên tục vượt ngưỡng 70%.

Alert: HPA workspace-service-hpa scale vượt min do CPU cao - critical
Description: workspace-service-hpa đang chạy 3 replicas — HPA tự động scale do CPU vượt 70%.
```

**Nói miệng (khi alert hiện ra):**
> "Và đây — Slack vừa nhận được cảnh báo tự động. Toàn bộ pipeline hoạt động: k6 tạo traffic → CPU tăng → HPA scale → Prometheus phát hiện → Alertmanager gửi vào Slack."

> "Alert chia 2 loại: **warning** cho service đã đạt max replicas, **critical** cho service đang scale vượt min. Đây là thông tin giúp team on-call biết ngay cần xem xét tăng giới hạn hoặc optimize code."

---

### Cảnh 6 — Load test kết thúc, hệ thống tự phục hồi (tùy chọn)

**Thao tác:** Chờ k6 chạy xong (~3 phút tổng), theo dõi Terminal 1.

**Nói miệng:**
> "Load test đã kết thúc. Bây giờ CPU giảm dần — HPA sẽ chờ **5 phút** ổn định trước khi scale down về 2 replicas. Kubernetes thiết kế vậy để tránh flapping — tức là scale up/down liên tục khi traffic dao động."

> "Sau ~5 phút, các bạn sẽ thấy REPLICAS tụt về 2 — hệ thống tự phục hồi về trạng thái ban đầu mà không cần thao tác gì."

---

## Tóm tắt điểm nhấn khi kết thúc demo

> "Mình vừa chứng minh **3 điều**:"
>
> 1. **Auto-scaling hoạt động:** hệ thống tự phát hiện CPU cao và scale từ 2 → 3 replicas trong vòng 30-60 giây.  
> 2. **Observability đầy đủ:** Grafana hiển thị realtime load, Prometheus thu thập metrics từ HPA qua kube-state-metrics.  
> 3. **Alerting tự động:** Không cần ai ngồi theo dõi — Alertmanager tự gửi cảnh báo vào Slack khi phát hiện sự kiện scale.

---

## Lệnh tham khảo nhanh

```bash
# Xem HPA realtime
kubectl get hpa -n collabspace -w

# Chạy load test
kubectl delete job k6-load-test -n collabspace --ignore-not-found=true
sed -e 's/value: "smoke"/value: "demo-flow"/' \
    -e 's/value: "10"/value: "50"/' \
    infrastructure/load-testing/k6-job.yaml | kubectl apply -f -

# Xem k6 log
kubectl logs -f -l app=k6-load-test -n collabspace

# Xem CPU pod realtime
kubectl top pods -n collabspace --sort-by=cpu

# Dọn dẹp sau demo
kubectl delete job k6-load-test -n collabspace --ignore-not-found=true
```

---

## Lưu ý khi demo

- **Bật HPA về 2 trước:** nếu cluster đang còn 3 replicas từ lần test trước, chờ ~5 phút sau khi không có traffic.
- **50 VUs** là con số ngẫu nhiên hợp lý — đủ để trigger HPA nhưng không crash cluster.
- **Grafana password:** hỏi team infra trước hoặc kiểm tra `kubectl get secret grafana -n collabspace -o jsonpath='{.data.admin-password}' | base64 -d`.
- **Nếu Slack chậm:** pipeline mất 60-90 giây là bình thường — `group_wait: 10s` + `for: 30s` + scrape 15s.
- **Nếu workspace 404:** đây là behavior đúng dưới tải — `workspace-service` đang scale, Kubernetes cần vài giây để route đến pod mới. Có thể nói thêm: "Đây là ví dụ thực tế cho thấy tại sao cần retry logic ở client."
