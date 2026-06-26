@echo off
SET KUBECONFIG=d:\Code\team\collabspace-doks-1-kubeconfig.yaml
color 0C
cls
echo ============================================================
echo   ACT 2 — CHAOS: LIVE DATABASE FAILOVER
echo   CloudNativePG: Kill Primary, Watch Self-Heal
echo ============================================================
echo.
echo --- Current cluster state (healthy) ---
kubectl get cluster postgres -n collabspace
echo.
echo Press any key to KILL the Primary database node (postgres-1)...
pause >nul
echo.
echo --- Killing postgres-1 NOW ---
kubectl delete pod postgres-1 -n collabspace --force --grace-period=0
echo.
echo --- Watching election (Ctrl+C to stop when new primary elected) ---
kubectl get pods -n collabspace -l cnpg.io/cluster=postgres -w
