# HighLatencyP99

**Cảnh báo:** p99 latency > 2 giây trong 5 phút  
**Mức độ:** warning

## Chẩn đoán

1. Kiểm tra gọi dependency chậm (gRPC user profile, HTTP client workspace).
2. Xem slow query DB và index Mongo.
3. So sánh traffic spike với capacity.

## Khắc phục

1. Khôi phục dependency chậm hoặc bật circuit-breaker fail-fast.
2. Thêm index hoặc tối ưu query nóng.
3. Scale replica và verify giới hạn connection pool.
