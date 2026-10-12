@echo off
cd /d "%~dp0"
node desktop\dev-tools.cjs test
if errorlevel 1 pause
