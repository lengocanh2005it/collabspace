# ServiceHighRestartRate

**Cảnh báo:** hơn 2 lần restart trong 15 phút  
**Mức độ:** warning

## Chẩn đoán

Kiểm tra OOM kill, exception khởi động chưa xử lý, và readiness probe fail.

## Khắc phục

1. Tăng memory limit nếu OOMKilled (xem `docs/production-hardening.md`).
2. Sửa thứ tự dependency khởi động (migration DB trước traffic).
3. Đảm bảo `preStop` sleep cho phép drain graceful (K8s deployment).
