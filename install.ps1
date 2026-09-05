# Copies the mod into the Civilization VII Mods folder (mirror: removed files are removed there too).
# Restart the game afterwards; it re-reads mods only at startup.
$src = Join-Path $PSScriptRoot "EuropeMediterranean"
$dst = Join-Path $env:LOCALAPPDATA "Firaxis Games\Sid Meier's Civilization VII\Mods\EuropeMediterranean"
robocopy $src $dst /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -le 7) { Write-Host "installed to $dst" } else { Write-Host "robocopy failed with code $LASTEXITCODE" }
