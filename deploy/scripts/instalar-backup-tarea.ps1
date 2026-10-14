# instalar-backup-tarea.ps1 — registra la tarea programada "Rest-Backup-Diario"
# (todos los dias 03:00) que ejecuta deploy\scripts\backup.ps1. Idempotente.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File deploy\scripts\instalar-backup-tarea.ps1

$ErrorActionPreference = "Stop"

$nombre = "Rest-Backup-Diario"
$script = Join-Path $PSScriptRoot "backup.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At 03:00
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::FromHours(1)) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

$existente = Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue
if ($existente) {
    Set-ScheduledTask -TaskName $nombre -Action $action -Trigger $trigger -Settings $settings | Out-Null
    Write-Output "tarea '$nombre' actualizada"
} else {
    Register-ScheduledTask -TaskName $nombre -Action $action -Trigger $trigger -Settings $settings | Out-Null
    Write-Output "tarea '$nombre' creada (diaria 03:00)"
}

Write-Output "ejecutando un primer respaldo de verificacion..."
& powershell -NoProfile -ExecutionPolicy Bypass -File $script
