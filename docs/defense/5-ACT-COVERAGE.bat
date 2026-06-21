@echo off
color 0D
echo =======================================================
echo     ACT 5: THE ARCHITECT'S PROOF (100%% TEST COVERAGE)
echo =======================================================
echo.
echo Running live unit tests and coverage analysis for Task Service...
echo Please wait...
cd ..\..\services\task-service
call npm run test:cov
echo.
echo Running live unit tests and coverage analysis for Notification Service...
cd ..\notification-service
call npm run test:cov
echo.
echo Notice the 100%% coverage on domain logic, command handlers, and query handlers.
pause
