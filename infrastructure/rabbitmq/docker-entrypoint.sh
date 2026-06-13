#!/bin/bash
set -e

# Load environment variables from .env
if [ -f /etc/rabbitmq/.env ]; then
  export $(grep -v '^#' /etc/rabbitmq/.env | xargs)
fi

# Default user/pass/vhost from env
: "${RABBITMQ_DEFAULT_USER:=guest}"
: "${RABBITMQ_DEFAULT_PASS:=guest}"
: "${RABBITMQ_DEFAULT_VHOST:=/}"

# Start RabbitMQ server in background
rabbitmq-server -detached

# Wait until RabbitMQ is ready
echo "Waiting for RabbitMQ to start..."
until rabbitmqctl status > /dev/null 2>&1; do
    sleep 1
done

# Add vhost
rabbitmqctl add_vhost $RABBITMQ_DEFAULT_VHOST || true

# Add user and set permissions
rabbitmqctl add_user $RABBITMQ_DEFAULT_USER $RABBITMQ_DEFAULT_PASS || true
rabbitmqctl set_user_tags $RABBITMQ_DEFAULT_USER administrator
rabbitmqctl set_permissions -p $RABBITMQ_DEFAULT_VHOST $RABBITMQ_DEFAULT_USER ".*" ".*" ".*"

# Import definitions.json (queues, exchanges, bindings)
rabbitmqctl stop_app
rabbitmqctl reset
rabbitmqctl start_app
rabbitmqctl import_definitions /etc/rabbitmq/definitions.json

# Keep container running
tail -f /dev/null