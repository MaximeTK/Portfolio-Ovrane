<#
.SYNOPSIS
    Script de démarrage Ngrok pour le projet Venta
.DESCRIPTION
    Démarre les tunnels pour le frontend (3000) et le backend (3001)
#>

$ScriptDir = Split-Path $MyInvocation.MyCommand.Path
$ConfigFile = Join-Path $ScriptDir "ngrok.yml"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Démarrage des tunnels Venta Ngrok" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Frontend cible : http://localhost:3000" -ForegroundColor Gray
Write-Host "Backend cible  : http://localhost:3001" -ForegroundColor Gray
Write-Host ""

# Démarrage du Backend
Write-Host "Lancement du Backend (Port 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\..\venta-backend'; npm start"

# Démarrage du Frontend
Write-Host "Lancement du Frontend (Port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\..\Venta'; npm run dev"

Write-Host "Attente de 5 secondes pour le démarrage des serveurs..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Vérification de ngrok local
$NgrokExe = Join-Path $ScriptDir "ngrok.exe"

if (Test-Path $NgrokExe) {
    Write-Host "Lancement du tunnel ngrok (Frontend 3000)..." -ForegroundColor Green
    
    # Lancement du tunnel unique
    & $NgrokExe http 3000
} else {
    Write-Host "ERREUR : ngrok.exe n'a pas été trouvé dans $ScriptDir" -ForegroundColor Red
    Write-Host "Veuillez placer l'exécutable ngrok.exe dans ce dossier." -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour quitter..."
}

