$src = "c:\Users\marco\civ7mods\EuropeMediterranean - Copy\editor"
$dst = "c:\Users\marco\civ7mods\editor"

# Ensure destination directory exists and copy contents
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Path "$src\*" -Destination $dst -Recurse -Force
Write-Host "Synced editor folder to $dst"

# Create run-editor.ps1 in civ7mods root
$runEditorContent = "# Launcher for Civilization VII Visual Map Editor`r`n# Starts the companion server and opens the visual editor in your browser.`r`n`$script = Join-Path `$PSScriptRoot ""editor\server.ps1""`r`npowershell -ExecutionPolicy Bypass -File `$script`r`n"
[System.IO.File]::WriteAllText("c:\Users\marco\civ7mods\run-editor.ps1", $runEditorContent, [System.Text.Encoding]::UTF8)
Write-Host "Created c:\Users\marco\civ7mods\run-editor.ps1"

# Create open-editor.bat for double-clicking
$batContent = "@echo off`r`npowershell -ExecutionPolicy Bypass -File ""%~dp0run-editor.ps1""`r`npause`r`n"
[System.IO.File]::WriteAllText("c:\Users\marco\civ7mods\open-editor.bat", $batContent, [System.Text.Encoding]::ASCII)
Write-Host "Created c:\Users\marco\civ7mods\open-editor.bat"
