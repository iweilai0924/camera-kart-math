@echo off
rem Windows: double-click to play offline. Starts a tiny local web server and opens the game in your browser.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
