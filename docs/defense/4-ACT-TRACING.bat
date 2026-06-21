@echo off
color 0E
echo =======================================================
echo     ACT 4: DISTRIBUTED TRACING & OUTBOX (JAEGER)
echo =======================================================
echo.
echo Launching the Jaeger Distributed Tracing UI...
start https://collabspace.ngocanh2005it.site/jaeger
echo.
echo Explain to the professors how a single request travels:
echo 1. Traefik Gateway -^> Workspace Service
echo 2. Workspace Service saves to Postgres Outbox
echo 3. Debezium CDC instantly reads the Postgres WAL
echo 4. Kafka routes it to Notification Service
echo.
echo You can trace this exact path natively in Jaeger.
pause
