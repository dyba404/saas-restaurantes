' Sesion WSL persistente SIN ventana visible (keep-alive de Rest).
' Lanzada por la tarea programada "Rest-WSL-Boot" via
' deploy/scripts/configurar-keepalive-wsl.ps1. Con esta sesion viva, wslservice
' nunca dispara el apagado por inactividad que mata dockerd y los contenedores.
' Si el proceso muere, el trigger de repeticion (cada 1 min) lo relanza.
Set sh = CreateObject("WScript.Shell")
sh.Run """wsl.exe"" -d Ubuntu --exec sleep infinity", 0, False
