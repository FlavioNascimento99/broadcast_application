@echo off
REM Script para iniciar todas as camadas da aplicação (Middleware, Backend, Frontend)
REM Uso: start-all.bat

chcp 65001 >nul
setlocal enabledelayedexpansion

color 0B
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║          PUBLISHER - Iniciando todas as camadas              ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Obter caminho base
set "BASE_PATH=%~dp0"
set "MIDDLEWARE_PATH=%BASE_PATH%middleware"
set "BACKEND_PATH=%BASE_PATH%backend"
set "FRONTEND_PATH=%BASE_PATH%frontend"

REM Verificar pastas
if not exist "%MIDDLEWARE_PATH%" (
    color 0C
    echo ❌ Pasta middleware não encontrada: %MIDDLEWARE_PATH%
    exit /b 1
)

if not exist "%BACKEND_PATH%" (
    color 0C
    echo ❌ Pasta backend não encontrada: %BACKEND_PATH%
    exit /b 1
)

if not exist "%FRONTEND_PATH%" (
    color 0C
    echo ❌ Pasta frontend não encontrada: %FRONTEND_PATH%
    exit /b 1
)

color 0A
echo ✅ Pastas verificadas
echo.

color 0E
echo 🚀 Iniciando Middleware (Go Broker - porta 9000)...
start "Publisher - Middleware" cmd /k "cd /d "%MIDDLEWARE_PATH%" && go run ./cmd/broker -client-addr :9000"

timeout /t 2 /nobreak

color 0A
echo 🚀 Iniciando Backend (Express - porta 3000)...
start "Publisher - Backend" cmd /k "cd /d "%BACKEND_PATH%" && npm run dev"

timeout /t 2 /nobreak

color 0D
echo 🚀 Iniciando Frontend (Vite - porta 3001)...
start "Publisher - Frontend" cmd /k "cd /d "%FRONTEND_PATH%" && npm run dev"

timeout /t 2 /nobreak

color 0B
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    TUDO INICIADO ✅                            ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

color 0E
echo 📍 Endereços:
color 0D
echo   🔗 Frontend:   http://localhost:3001
color 0A
echo   🔗 Backend:    http://localhost:3000
color 0B
echo   🔗 Middleware: localhost:9000
echo.

color 0E
echo 💡 Dicas:
color 07
echo   • Use Ctrl+C em cada janela para parar o serviço
echo   • Abra http://localhost:3001 no navegador
echo   • Veja Status Dashboard no canto inferior direito
echo   • Console Logger no canto inferior esquerdo
echo.

color 0B
echo ⏳ Janelas iniciadas. Feche este prompt quando terminar.
echo.

pause
