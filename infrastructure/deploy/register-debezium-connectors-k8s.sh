#!/usr/bin/env bash
# Register Debezium outbox connectors against in-cluster Connect REST.
#
# Usage (on Droplet or with KUBECONFIG):
#   export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
#   bash infrastructure/deploy/register-debezium-connectors-k8s.sh
set -euo pipefail

APP_NS="${APP_NS:-collabspace}"
CONNECT_URL="${DEBEZIUM_CONNECT_URL:-http://debezium-connect:8083}"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

echo "==> Waiting for Debezium Connect..."
for i in $(seq 1 60); do
  if kubectl exec -n "$APP_NS" deploy/debezium-connect -- curl -sf "$CONNECT_URL/connectors" >/dev/null 2>&1; then
    echo "Connect ready"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "FAIL: Debezium Connect not ready"
    exit 1
  fi
  sleep 5
done

echo "==> Applying connector ConfigMap (if chart rendered it)..."
if kubectl get configmap debezium-connectors -n "$APP_NS" >/dev/null 2>&1; then
  kubectl delete job register-debezium-connectors -n "$APP_NS" --ignore-not-found
  cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: register-debezium-connectors
  namespace: ${APP_NS}
spec:
  backoffLimit: 4
  template:
    metadata:
      labels:
        app: register-debezium-connectors
    spec:
      restartPolicy: OnFailure
      containers:
        - name: register
          image: alpine:3.20
          command:
            - /bin/sh
            - -ec
            - |
              apk add --no-cache jq curl >/dev/null
              CONNECT_URL="${CONNECT_URL}"
              for file in /connectors/*.json; do
                connector_name="\$(jq -r .name "\$file")"
                echo "==> Registering \$connector_name"
                if curl -sf "\$CONNECT_URL/connectors/\$connector_name" >/dev/null 2>&1; then
                  jq -c .config "\$file" | curl -sf -X PUT -H "Content-Type: application/json" --data-binary @- "\$CONNECT_URL/connectors/\$connector_name/config" >/dev/null
                  echo "Updated \$connector_name"
                else
                  jq -c '{name:.name, config:.config}' "\$file" | curl -sf -X POST -H "Content-Type: application/json" --data-binary @- "\$CONNECT_URL/connectors" >/dev/null
                  echo "Created \$connector_name"
                fi
                curl -sf "\$CONNECT_URL/connectors/\$connector_name/status" | jq -c '{connector:.connector.state, task:(.tasks[0].state // "none")}'
              done
          volumeMounts:
            - name: connectors
              mountPath: /connectors
      volumes:
        - name: connectors
          configMap:
            name: debezium-connectors
            items:
              - key: workspace-outbox.json
                path: workspace-outbox.json
              - key: user-outbox.json
                path: user-outbox.json
              - key: task-outbox.json
                path: task-outbox.json
EOF
  kubectl wait --for=condition=complete job/register-debezium-connectors -n "$APP_NS" --timeout=300s
  kubectl logs -n "$APP_NS" job/register-debezium-connectors
  echo "==> Connectors registered."
else
  echo "FAIL: ConfigMap debezium-connectors missing — run helm upgrade with debeziumConnect.connectors.enabled=true"
  exit 1
fi
