@echo off
color 0A
echo =======================================================
echo     ACT 1: THE HEARTBEAT (TRAFFIC SIMULATION)
echo =======================================================
echo.
echo Injecting live traffic into the production gateway...
ssh root@167.172.77.110 "timeout 60s sh -c 'while true; do curl -k -s https://collabspace.ngocanh2005it.site/api/v1/workspaces > /dev/null; sleep 0.1; done'"
echo.
echo Traffic Simulation Completed!
pause
