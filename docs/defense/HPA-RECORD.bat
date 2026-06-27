@echo off
title HPA Demo — One Screen
setlocal enabledelayedexpansion
SET KUBECONFIG=d:\Code\team\collabspace-doks-1-kubeconfig.yaml
cd /d D:\Code\team\collabspace
color 0B

REM ---------- PRE-FLIGHT ----------
cls
echo [1/3] Checking cluster...
kubectl get nodes --no-headers 2>nul >nul
if errorlevel 1 (
    echo FAIL: Can't reach cluster. Check VPN.
    pause & exit /b 1
)
echo   OK

REM Kill any leftover k6 job
kubectl delete job k6-load-test -n collabspace --ignore-not-found=true >nul 2>nul

echo [2/3] Checking HPA status...
echo.
kubectl get hpa -n collabspace
echo.
echo   Waiting up to 60s for HPA to settle at 2...
set waited=0
:wait_hpa
kubectl get hpa -n collabspace -o jsonpath="{range .items[*]}{.status.currentReplicas}{' '}{end}" > %TEMP%\hpa_chk.txt 2>nul
set /p hpa_r=<%TEMP%\hpa_chk.txt
echo !hpa_r! | findstr "3" >nul
set found3=%errorlevel%
if !found3! equ 0 (
    set /a waited+=1
    if !waited! geq 12 (
        echo.
        echo   HPA still at 3 after 60s. CPU may still be high.
        choice /c YN /n /m " Continue anyway? [Y] Yes / [N] No "
        if errorlevel 2 exit /b
        goto ready
    )
    timeout /t 5 /nobreak >nul
    goto wait_hpa
)
echo   Ready! All at 2 replicas.

REM ---------- PREP BROWSER ----------
:ready
echo [3/3] Opening Grafana + Slack in browser...
start "" "https://collabspace.ngocanh2005it.site/grafana/d/collabspace-load-test/collabspace-load-test-run"
start "" "https://app.slack.com/client/"

REM ---------- RECORD ----------
cls
echo ============================================================
echo   PRESS ENTER TO START DEMO (then hit record)
echo ============================================================
pause >nul

REM ---------- SCENE 1 ----------
cls
echo ============================================================
echo   [SCENE 1] Current HPA state
echo   Say: "HPA watches CPU. Threshold is 70%%."
echo ============================================================
kubectl get hpa -n collabspace
timeout /t 8 /nobreak >nul

REM ---------- SCENE 2 ----------
cls
echo ============================================================
echo   [SCENE 2] Deploying 50 virtual users...
echo   Say: "50 concurrent users hitting the API."
echo ============================================================
kubectl delete job k6-load-test -n collabspace --ignore-not-found=true >nul 2>nul
kubectl apply -f infrastructure\load-testing\k6-job-hpa-demo.yaml -n collabspace >nul
:wait_pod
timeout /t 3 /nobreak >nul
kubectl get pod -l app=k6-load-test -n collabspace --no-headers 2>nul | findstr "Running" >nul
if errorlevel 1 goto wait_pod
timeout /t 3 /nobreak >nul
cls
echo ============================================================
echo   [SCENE 2] k6 running - 50 VUs
echo ============================================================
kubectl logs -l app=k6-load-test -n collabspace --tail=20 2>nul
echo.
timeout /t 8 /nobreak >nul

REM ---------- SCENE 3 ----------
set scaled=0
:monitor
kubectl get hpa -n collabspace -o jsonpath="{range .items[*]}{.status.currentReplicas}{' '}{end}" > %TEMP%\hpa_mon.txt 2>nul
set /p hpa_cur=<%TEMP%\hpa_mon.txt
cls
echo ============================================================
echo   [SCENE 3] Watching HPA (refreshes every 5s)
echo   Watch REPLICAS change. Alt-tab to Grafana/Slack.
echo   Press Ctrl+C to end.
echo ============================================================
echo.
kubectl get hpa -n collabspace
echo.
echo !hpa_cur! | findstr "3" >nul
if !errorlevel! equ 0 (
    if !scaled! equ 0 (
        echo ============================================
        echo   ***** HPA SCALED! REPLICAS 2 -^> 3 *****
        echo   Say: "CPU exceeded 70%%, auto-scaled to 3"
        echo ============================================
        set scaled=1
    ) else (
        echo   HPA at 3 replicas (scaled up)
    )
) else (
    if !scaled! equ 1 (echo   HPA scaled back to 2
    ) else (echo   All at 2 replicas - waiting for CPU spike...)
)
timeout /t 5 /nobreak >nul
goto monitor
