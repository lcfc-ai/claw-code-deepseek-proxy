@echo off
setlocal

set "PROXY_DIR=%~dp0"
if "%PROXY_DIR:~-1%"=="\" set "PROXY_DIR=%PROXY_DIR:~0,-1%"
set "DIST_ENTRY=%PROXY_DIR%\dist\server.js"
set "BUNDLED_NODE=%PROXY_DIR%\runtime\node.exe"
set "NODE_CMD=node"

if not exist "%PROXY_DIR%\package.json" (
  echo [error] Proxy package.json not found: "%PROXY_DIR%\package.json"
  exit /b 1
)

if exist "%BUNDLED_NODE%" (
  set "NODE_CMD=%BUNDLED_NODE%"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo [error] node was not found in PATH and bundled node.exe is missing.
    echo [hint] Put a portable Node runtime at "%BUNDLED_NODE%" or install Node.js 20+.
    exit /b 1
  )
)

if not exist "%PROXY_DIR%\.env" (
  if exist "%PROXY_DIR%\.env.example" (
    copy /Y "%PROXY_DIR%\.env.example" "%PROXY_DIR%\.env" >nul
    echo [info] Created "%PROXY_DIR%\.env" from .env.example.
    echo [info] Edit .env and set UPSTREAM_API_KEY before using the proxy.
  ) else (
    echo [warn] .env.example was not found. Continuing without creating .env.
  )
)

findstr /R /C:"^UPSTREAM_API_KEY=.$" "%PROXY_DIR%\.env" >nul 2>nul
if errorlevel 1 (
  findstr /R /C:"^UPSTREAM_API_KEY=.." "%PROXY_DIR%\.env" >nul 2>nul
  if errorlevel 1 (
    echo [error] UPSTREAM_API_KEY is empty in "%PROXY_DIR%\.env".
    echo [hint] Edit "%PROXY_DIR%\.env" and set:
    echo        UPSTREAM_API_KEY=your_deepseek_key
    exit /b 1
  )
)

pushd "%PROXY_DIR%"

if not exist "%PROXY_DIR%\node_modules" (
  where npm >nul 2>nul
  if errorlevel 1 (
    popd
    echo [error] npm was not found in PATH, so dependencies cannot be installed automatically.
    echo [hint] For customer delivery, package node_modules ahead of time.
    exit /b 1
  )

  echo [info] Installing proxy dependencies...
  call npm install
  if errorlevel 1 (
    set "EXIT_CODE=%errorlevel%"
    popd
    echo [error] npm install failed.
    exit /b %EXIT_CODE%
  )
)

if not exist "%DIST_ENTRY%" (
  where npm >nul 2>nul
  if errorlevel 1 (
    popd
    echo [error] npm was not found in PATH, so the proxy cannot be built automatically.
    echo [hint] For customer delivery, build dist ahead of time.
    exit /b 1
  )

  echo [info] Building proxy output...
  call npm run build
  if errorlevel 1 (
    set "EXIT_CODE=%errorlevel%"
    popd
    echo [error] npm run build failed.
    exit /b %EXIT_CODE%
  )
)

echo [info] Starting DeepSeek compatibility proxy from dist...
"%NODE_CMD%" "%DIST_ENTRY%"
set "EXIT_CODE=%errorlevel%"
popd
exit /b %EXIT_CODE%
