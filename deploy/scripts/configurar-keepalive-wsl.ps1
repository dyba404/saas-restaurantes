# Configura la tarea programada "Rest-WSL-Boot": mantiene viva la distro WSL
# (Ubuntu) donde corre Docker con el stack de producción de Rest.
#
# Patrón traído de OdontoFlow (scripts/configurar-keepalive-wsl.ps1): cuando la
# última sesión interactiva de WSL termina, wslservice apaga la instancia por
# inactividad y eso mata dockerd y TODOS los contenedores. Esta tarea lanza una
# sesión OCULTA persistente (wscript → VBS → wsl sleep infinity) para que eso
# nunca ocurra. El trigger de repetición cada 1 min la relanza si muriera.
#
# Qué NO hace: no toca otros proyectos. Al arrancar la distro, systemd levanta
# dockerd, y SOLO los contenedores con restart: unless-stopped se recuperan —
# en este stack, únicamente los de rest-prod (odontoflow/gimnasio dependen de
# sus propias políticas).
#
# Requisitos (una sola vez): systemd activo en Ubuntu y docker habilitado.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File deploy\scripts\configurar-keepalive-wsl.ps1

$ErrorActionPreference = "Stop"

$nombre = "Rest-WSL-Boot"
$vbs = Join-Path $PSScriptRoot "keepalive-sesion.vbs"

# Preflight: systemd activo en la distro + docker habilitado al boot
wsl.exe -d Ubuntu -u root -- bash -c "printf '[boot]\nsystemd=true\n' > /etc/wsl.conf; systemctl is-enabled docker >/dev/null 2>&1 || (systemctl enable docker >/dev/null 2>&1 || service docker start)" 2>$null

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
$triggerLoop = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([TimeSpan]::FromDays(3650))
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

$existente = Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue
if ($existente) {
  Set-ScheduledTask -TaskName $nombre -Action $action -Trigger @($triggerLogon, $triggerLoop) -Settings $settings | Out-Null
  Write-Output "tarea '$nombre' actualizada (lanzamiento oculto via VBS)"
} else {
  Register-ScheduledTask -TaskName $nombre -Action $action -Trigger @($triggerLogon, $triggerLoop) -Settings $settings | Out-Null
  Write-Output "tarea '$nombre' creada (lanzamiento oculto via VBS)"
}

Start-ScheduledTask -TaskName $nombre
Write-Output "sesion persistente oculta iniciada (wscript -> wsl sleep infinity)"
