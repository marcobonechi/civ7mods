# Copies every mod in this repository into the Civilization VII Mods folder (mirror: files
# removed here are removed there too). A mod is any top-level folder holding a .modinfo file.
# A mod's dlc\ subfolder holds binary art packages, which go into the game install's DLC\.
# Restart the game afterwards; it re-reads mods only at startup.
# Usage: .\install.ps1                  (all mods)
#        .\install.ps1 Byzantium ...    (only the named mod folders)
param([string[]]$Names)

$mods = Join-Path $env:LOCALAPPDATA "Firaxis Games\Sid Meier's Civilization VII\Mods"

# The game install (for art packages): CIV7_GAME_ROOT, else the usual Steam library folders.
$gameRoot = $env:CIV7_GAME_ROOT
if (-not $gameRoot) {
    foreach ($lib in @("${env:ProgramFiles(x86)}\Steam", "$env:ProgramFiles\Steam", "C:\SteamLibrary", "D:\SteamLibrary", "D:\Steam")) {
        $cand = Join-Path $lib "steamapps\common\Sid Meier's Civilization VII"
        if (Test-Path (Join-Path $cand "DLC")) { $gameRoot = $cand; break }
    }
}
$gameDlc = $null
if ($gameRoot -and (Test-Path (Join-Path $gameRoot "DLC"))) { $gameDlc = Join-Path $gameRoot "DLC" }
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
    robocopy $src $dst /MIR /NFL /NDL /NJH /NJS /NP /XF .DS_Store /XD dlc | Out-Null
    if ($LASTEXITCODE -le 7) { Write-Host "installed to $dst" } else { Write-Host "robocopy failed with code $LASTEXITCODE" }

    # Binary art packages (<Mod>\dlc\<Group>\<Group>.dep + Platforms\Windows\BLPs) are only
    # found by the game inside its own install, under DLC\. Mirror each one there.
    $dlcSrc = Join-Path $src "dlc"
    if (Test-Path $dlcSrc) {
        foreach ($group in Get-ChildItem -Path $dlcSrc -Directory) {
            if (-not (Get-ChildItem -Path $group.FullName -Filter *.dep -File)) { continue }
            if (-not $gameDlc) { Write-Host "  art package $($group.Name) not installed: game DLC folder not found (set CIV7_GAME_ROOT)"; continue }
            $gdst = Join-Path $gameDlc $group.Name
            robocopy $group.FullName $gdst /MIR /NFL /NDL /NJH /NJS /NP /XF .DS_Store | Out-Null
            if ($LASTEXITCODE -le 7) { Write-Host "  art package installed to $gdst" } else { Write-Host "robocopy failed with code $LASTEXITCODE" }
        }
    }
}
