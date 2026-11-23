@echo off
setlocal
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org/ then open this file again.
  pause
  exit /b 1
)
node "%~dp0studio.cjs" "%~dp0.."
set "album_exit=%errorlevel%"
pause
exit /b %album_exit%
