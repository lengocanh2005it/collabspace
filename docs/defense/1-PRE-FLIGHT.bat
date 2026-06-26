@echo off
SET KUBECONFIG=d:\Code\team\collabspace-doks-1-kubeconfig.yaml
color 0A
cls
echo ============================================================
echo   PRE-FLIGHT CHECK
echo   Verifying cluster is healthy before recording
echo ============================================================
echo.
echo --- Nodes ---
kubectl get nodes
echo.
echo --- Pods (checking for failures) ---
kubectl get pods -n collabspace | findstr /V "Running Completed"
if %ERRORLEVEL%==1 echo All pods healthy.
echo.
echo --- Cluster status ---
kubectl get cluster postgres -n collabspace
echo.
echo ============================================================
echo   If everything looks green, you're good to record.
echo   Open browser tabs:
echo     https://collabspace.ngocanh2005it.site/grafana
echo     https://collabspace.ngocanh2005it.site/jaeger
echo ============================================================
pause
