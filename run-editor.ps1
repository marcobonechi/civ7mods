# Launcher for Civilization VII Visual Map Editor
# Starts the companion server and opens the visual editor in your browser.
$script = Join-Path $PSScriptRoot "editor\server.ps1"
powershell -ExecutionPolicy Bypass -File $script
