@echo off
setlocal
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to create an album.
  echo Install the LTS version from https://nodejs.org/ and try again.
  echo Existing albums can be opened with index.html without Node.js.
  pause
  exit /b 1
)
node "%~dp0create.cjs" --interactive
set "album_exit=%errorlevel%"
echo.
pause
exit /b %album_exit%
