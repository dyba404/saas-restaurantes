# Backup diario de la DB de Rest (Postgres en Docker/WSL).
# Adaptado del patron de OdontoFlow: pg_dump dentro del contenedor -> carpeta
# local backups/ con retencion de 14 dias.
#
# Uso manual:  powershell -NoProfile -ExecutionPolicy Bypass -File deploy\scripts\backup.ps1
# Automatico:  deploy\scripts\instalar-backup-tarea.ps1 (tarea programada diaria 03:00)

$ErrorActionPreference = "Stop"

$wslCmd = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wslCmd) {
    Write-Host "ERROR: wsl.exe no esta disponible en este equipo." -ForegroundColor Red
    exit 1
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backupsDir = Join-Path $repoRoot "backups"
if (-not (Test-Path -LiteralPath $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir | Out-Null
}

Write-Host "Iniciando respaldo de la base de datos Rest..."

& wsl.exe -d Ubuntu -- docker exec rest-prod-db pg_dump -U rest -d rest -Fc -f /tmp/rest_backup.dump
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pg_dump fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

$marca = Get-Date -Format "yyyyMMdd_HHmmss"
$archivoLocal = Join-Path $backupsDir ("rest_backup_" + $marca + ".dump")

& cmd /c ("wsl.exe -d Ubuntu -- docker cp rest-prod-db:/tmp/rest_backup.dump - > `"" + $archivoLocal + "`"")
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: la copia del respaldo fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

& wsl.exe -d Ubuntu -- docker exec rest-prod-db rm -f /tmp/rest_backup.dump

if (-not (Test-Path -LiteralPath $archivoLocal)) {
    Write-Host "ERROR: no se genero el archivo local del respaldo." -ForegroundColor Red
    exit 1
}
$tamano = [math]::Round((Get-Item -LiteralPath $archivoLocal).Length / 1KB, 1)
Write-Host "Resaldo creado: $archivoLocal ($tamano KB)" -ForegroundColor Green

# Retencion: conservar los ultimos 14 dias
$limite = (Get-Date).AddDays(-14)
Get-ChildItem -LiteralPath $backupsDir -Filter "rest_backup_*.dump" |
    Where-Object { $_.LastWriteTime -lt $limite } |
    ForEach-Object { Write-Host "Retencion: eliminando $($_.Name)"; Remove-Item -LiteralPath $_.FullName }
