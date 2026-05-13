@echo off
echo Cleaning build artifacts...
for /d /r "%~dp0..\..\services" %%d in (node_modules, dist, build, .nest) do @if exist "%%d" rd /s /q "%%d"
echo Done.
