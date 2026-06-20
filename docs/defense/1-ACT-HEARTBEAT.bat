@echo off
color 0A
echo =======================================================
echo     ACT 1: THE HEARTBEAT (K6 LOAD TEST - DEMO FLOW)
echo =======================================================
echo.
echo Launching actual k6 load test via Docker...
docker run --rm -i -v "%~dp0..\..\infrastructure\load-testing\k6:/k6" -e BASE_URL=https://collabspace.ngocanh2005it.site/api/v1 -e GRAFANA_URL=https://collabspace.ngocanh2005it.site/grafana -e GRAFANA_PASSWORD=admin123 grafana/k6 run /k6/scenarios/demo-flow.js
echo.
echo Load Test Completed!
pause
