@echo off
SET KUBECONFIG=d:\Code\team\collabspace-doks-1-kubeconfig.yaml
color 0A
cls
echo ============================================================
echo   CONFIRM: Cluster Self-Healed
echo ============================================================
echo.
echo --- New cluster state (should show new primary) ---
kubectl get cluster postgres -n collabspace
echo.
echo --- Pods ---
kubectl get pods -n collabspace -l cnpg.io/cluster=postgres
echo.
echo ============================================================
echo   SAY: "New primary was elected automatically.
echo   Cluster healed itself. No human intervention."
echo ============================================================
pause
