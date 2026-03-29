# -----------------------------
# Dockerfile for CollabSpace RabbitMQ
# -----------------------------
FROM rabbitmq:3-management

# Copy definitions.json vào container
COPY definitions.json /etc/rabbitmq/definitions.json

# Enable RabbitMQ management plugin (mặc định image đã bật)
RUN rabbitmq-plugins enable --offline rabbitmq_management

# Copy entrypoint script (optional, dùng để load env và definitions)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Override default entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Expose ports
EXPOSE 5672 15672