@echo off
SET KUBECONFIG=d:\Code\team\collabspace-doks-1-kubeconfig.yaml
set SCENARIO=%~1
if "%SCENARIO%"=="" set SCENARIO=smoke

color 0D
cls
echo ============================================================
echo   K6 LOAD TEST DEMO
echo   Running scenario: %SCENARIO% on the DOKS cluster
echo ============================================================
echo.
echo Opening Grafana Load Test dashboard in your browser...
start https://collabspace.ngocanh2005it.site/grafana/d/collabspace-load-test/collabspace-load-test-run
echo.
echo --- Deploying k6 load test to the cluster ---
kubectl delete job k6-load-test -n collabspace --ignore-not-found=true >nul 2>&1
kubectl apply -f "%~dp0..\..\infrastructure\load-testing\k6-job.yaml"
echo.
echo --- Waiting for k6 pod to be ready (init container may take a few seconds) ---
:wait
kubectl wait --for=condition=Ready pod -n collabspace -l app=k6-load-test --timeout=120s >nul 2>&1
if %ERRORLEVEL% neq 0 (
  timeout /t 2 /nobreak >nul
  goto wait
)
echo.
echo ============================================================
echo   k6 is running on the cluster!
echo   Watch the Grafana dashboard for real-time changes.
echo   Orange markers on the timeline = your load test.
echo ============================================================
echo.
echo --- k6 output (streaming from the cluster pod) ---
kubectl logs -n collabspace -l app=k6-load-test --follow --tail=10

echo.
echo ============================================================
echo   Load test complete! Check Grafana for results.
echo ============================================================
pause
