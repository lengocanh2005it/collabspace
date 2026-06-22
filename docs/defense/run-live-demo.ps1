$ErrorActionPreference = "Stop"

function Pause-Step ($Message) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Yellow
    Write-Host "Press [ENTER] to execute the command..." -ForegroundColor DarkGray
    Read-Host
}

Clear-Host
Write-Host "🎓 CollabSpace Live Infrastructure Demonstration Script 🎓" -ForegroundColor Magenta
Write-Host "Please start your screen recorder now." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Start-Sleep -Seconds 2

Pause-Step "DEMONSTRATION 1: The Live Frontend & High Availability Destruction Test`nOpen https://collabspace.ngocanh2005it.site/ in your browser. We will now forcefully delete a frontend pod."
$pod = (kubectl get pods -l app=collabspace-frontend -n collabspace -o jsonpath="{.items[0].metadata.name}")
Write-Host "> kubectl delete pod $pod -n collabspace --force" -ForegroundColor White
kubectl delete pod $pod -n collabspace --force
Write-Host "Pod destroyed. Refresh the browser immediately to prove zero downtime." -ForegroundColor Green

Pause-Step "DEMONSTRATION 2: Live Zero-Downtime Scaling`nWe will scale the workspace-service from 1 replica to 3 replicas."
Write-Host "> kubectl scale deployment workspace-service -n collabspace --replicas=3" -ForegroundColor White
kubectl scale deployment workspace-service -n collabspace --replicas=3
Write-Host "Scale command issued. Traefik is instantly balancing traffic to the new pods." -ForegroundColor Green

Pause-Step "DEMONSTRATION 3: Stateful Database Failover (CloudNativePG)`nWe will view the Postgres cluster status, then forcefully kill the Primary database node."
Write-Host "> kubectl get cluster postgres -n collabspace" -ForegroundColor White
kubectl get cluster postgres -n collabspace
Start-Sleep -Seconds 2

Write-Host "`nForcefully deleting the Primary Postgres pod..." -ForegroundColor Red
$primaryPod = (kubectl get pods -l role=primary -n collabspace -o jsonpath="{.items[0].metadata.name}")
Write-Host "> kubectl delete pod $primaryPod -n collabspace --force" -ForegroundColor White
kubectl delete pod $primaryPod -n collabspace --force

Write-Host "Primary database destroyed! Watching the CNPG operator hold an election and promote a replica..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Write-Host "> kubectl get cluster postgres -n collabspace" -ForegroundColor White
kubectl get cluster postgres -n collabspace

Pause-Step "DEMONSTRATION 4: Automated Safeguards (Failed Rollout Prevention)`nWe will push a broken image to the auth-service."
Write-Host "> kubectl set image deployment/auth-service auth-service=nginx:alpine -n collabspace" -ForegroundColor White
kubectl set image deployment/auth-service auth-service=nginx:alpine -n collabspace
Write-Host "Update pushed. Kubernetes readiness probes will detect the failure and refuse to terminate the healthy pods." -ForegroundColor Green

Pause-Step "Reverting the broken rollout..."
Write-Host "> kubectl rollout undo deployment/auth-service -n collabspace" -ForegroundColor White
kubectl rollout undo deployment/auth-service -n collabspace
Write-Host "Rollout undone." -ForegroundColor Green

Pause-Step "DEMONSTRATION 5: Secure Secret Injection (Vault)`nDisplaying External Secrets actively pulling credentials from HashiCorp Vault."
Write-Host "> kubectl get externalsecrets -n collabspace" -ForegroundColor White
kubectl get externalsecrets -n collabspace

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🎉 DEMONSTRATION COMPLETE 🎉" -ForegroundColor Magenta
Write-Host "You may stop your screen recorder." -ForegroundColor Green
