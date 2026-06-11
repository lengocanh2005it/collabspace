$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$rulesFile = Join-Path $root "monitoring\alert-rules.yml"

kubectl create configmap prometheus-alert-rules `
  --from-file="alert-rules.yml=$rulesFile" `
  -n collabspace `
  --dry-run=client -o yaml | kubectl apply -f -

Write-Host "Synced alert-rules.yml to configmap/prometheus-alert-rules in collabspace"
