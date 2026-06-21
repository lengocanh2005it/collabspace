@echo off
color 0C
echo =======================================================
echo     ACT 2: CHAOS ENGINEER (KILLING AUTH SERVICE)
echo =======================================================
echo.
echo Logging into production cluster and terminating auth-service...
kubectl delete pod -n collabspace -l app=auth-service
echo.
echo BOOM. Pod destroyed. Watch the Grafana dashboard self-heal.
pause
