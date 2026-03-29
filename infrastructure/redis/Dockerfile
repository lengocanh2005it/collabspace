FROM redis:7

# Copy redis.conf nếu cần
COPY redis.conf /usr/local/etc/redis/redis.conf

# Start redis với config
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]