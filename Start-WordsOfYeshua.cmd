@echo off
setlocal
cd /d "%~dp0"

set "WOY_NPM=C:\Program Files\nodejs\npm.cmd"

if not exist "%WOY_NPM%" (
  echo Words of Yeshua needs the current Node.js installation at:
  echo %WOY_NPM%
  echo.
  echo Install the current Node.js LTS release, then try again.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing Words of Yeshua dependencies...
  call "%WOY_NPM%" install
  if errorlevel 1 (
    echo.
    echo Installation did not complete. Review the error above.
    pause
    exit /b 1
  )
)

echo Starting Words of Yeshua...
call "%WOY_NPM%" run dev

if errorlevel 1 (
  echo.
  echo Words of Yeshua stopped because of the error above.
  pause
  exit /b 1
)
