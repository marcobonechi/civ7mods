# Copies every mod in this repository into the Civilization VII Mods folder (mirror: files
# removed here are removed there too). A mod is any top-level folder holding a .modinfo file.
# Restart the game afterwards; it re-reads mods only at startup.
# Usage: .\install.ps1                  (all mods)
#        .\install.ps1 Byzantium ...    (only the named mod folders)
param([string[]]$Names)

$mods = Join-Path $env:LOCALAPPDATA "Firaxis Games\Sid Meier's Civilization VII\Mods"
if (-not $Names) {
    $Names = Get-ChildItem -Path $PSScriptRoot -Directory |
        Where-Object { Get-ChildItem -Path $_.FullName -Filter *.modinfo -File } |
        ForEach-Object { $_.Name }
}
if (-not $Names) { throw "no mod folders found (a mod folder holds a .modinfo)" }

foreach ($name in $Names) {
    $src = Join-Path $PSScriptRoot $name
    $dst = Join-Path $mods $name
    if (-not (Test-Path $src)) { throw "source not found: $src" }
    if (-not (Get-ChildItem -Path $src -Filter *.modinfo -File)) { throw "no .modinfo in $src" }
    robocopy $src $dst /MIR /NFL /NDL /NJH /NJS /NP /XF .DS_Store | Out-Null
    if ($LASTEXITCODE -le 7) { Write-Host "installed to $dst" } else { Write-Host "robocopy failed with code $LASTEXITCODE" }
}
