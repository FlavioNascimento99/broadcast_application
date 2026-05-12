# Script para iniciar todas as camadas da aplicação (Middleware, Backend, Frontend)
# Uso: .\start-all.ps1

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          PUBLISHER - Iniciando todas as camadas              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$basePath = $PSScriptRoot
$middlewarePath = Join-Path $basePath "middleware"
$backendPath = Join-Path $basePath "backend"
$frontendPath = Join-Path $basePath "frontend"

# Verificar se as pastas existem
if (-not (Test-Path $middlewarePath)) {
    Write-Host "❌ Pasta middleware não encontrada: $middlewarePath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $backendPath)) {
    Write-Host "❌ Pasta backend não encontrada: $backendPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $frontendPath)) {
    Write-Host "❌ Pasta frontend não encontrada: $frontendPath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Pastas verificadas" -ForegroundColor Green
Write-Host ""

# Função para iniciar processo em nova janela
function Start-Service {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Command,
        [string]$Color
    )
    
    Write-Host "🚀 Iniciando $Name..." -ForegroundColor $Color
    
    $process = Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$Path'; Write-Host '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' -ForegroundColor $Color; Write-Host '$Name' -ForegroundColor $Color -NoNewline; Write-Host ' - Porta: $(if ('`$Name' -eq 'Middleware') { '9000' } elseif ('`$Name' -eq 'Backend') { '3000' } else { '3001' })' -ForegroundColor $Color; Write-Host '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' -ForegroundColor $Color; Write-Host ''; $Command"
    ) -PassThru
    
    return $process
}

Write-Host "📋 Iniciando serviços em paralelo..." -ForegroundColor Yellow
Write-Host ""

# Iniciar Middleware (Go Broker)
$middlewareProcess = Start-Service `
    -Name "Middleware (Go Broker)" `
    -Path $middlewarePath `
    -Command "go run ./cmd/broker -client-addr :9000" `
    -Color Cyan

Start-Sleep -Milliseconds 1500

# Iniciar Backend (Node.js + Express)
$backendProcess = Start-Service `
    -Name "Backend (Express + Socket.IO)" `
    -Path $backendPath `
    -Command "npm run dev" `
    -Color Green

Start-Sleep -Milliseconds 1500

# Iniciar Frontend (Vite)
$frontendProcess = Start-Service `
    -Name "Frontend (React + Vite)" `
    -Path $frontendPath `
    -Command "npm run dev" `
    -Color Magenta

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    TUDO INICIADO ✅                            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "📍 Endereços:" -ForegroundColor Yellow
Write-Host "  🔗 Frontend:   http://localhost:3001" -ForegroundColor Magenta
Write-Host "  🔗 Backend:    http://localhost:3000" -ForegroundColor Green
Write-Host "  🔗 Middleware: localhost:9000" -ForegroundColor Cyan
Write-Host ""

Write-Host "💡 Dicas:" -ForegroundColor Yellow
Write-Host "  • Use Ctrl+C em cada janela para parar o serviço" -ForegroundColor Gray
Write-Host "  • Abra http://localhost:3001 no navegador" -ForegroundColor Gray
Write-Host "  • Veja Status Dashboard no canto inferior direito" -ForegroundColor Gray
Write-Host "  • Console Logger no canto inferior esquerdo" -ForegroundColor Gray
Write-Host ""

Write-Host "⏳ Aguardando processos..." -ForegroundColor Yellow
Write-Host ""

# Manter o script rodando
while ($true) {
    Start-Sleep -Seconds 5
    
    # Verificar se algum processo terminou
    if (-not (Get-Process -Id $middlewareProcess.Id -ErrorAction SilentlyContinue)) {
        Write-Host "⚠️  Middleware foi encerrado" -ForegroundColor Yellow
    }
    
    if (-not (Get-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue)) {
        Write-Host "⚠️  Backend foi encerrado" -ForegroundColor Yellow
    }
    
    if (-not (Get-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue)) {
        Write-Host "⚠️  Frontend foi encerrado" -ForegroundColor Yellow
    }
}
