@echo off
cd /d "%~dp0"
node desktop\dev-tools.cjs dev
if errorlevel 1 pause
