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

# robocopy reports what it did in its exit code: under 8 is success (1 means "files copied"),
# 8 and over is a real failure. Left alone it would also become this script's own exit code, so
# a normal install would look like a failure to anything checking it.
$failed = 0
function Copy-Mirror($from, $to, $label, $extra) {
    robocopy $from $to /MIR /NFL /NDL /NJH /NJS /NP /XF .DS_Store ._* @extra | Out-Null
    if ($LASTEXITCODE -lt 8) { Write-Host "$label $to" }
    else { Write-Host "ROBOCOPY FAILED ($LASTEXITCODE) copying to $to"; $script:failed++ }
}

foreach ($name in $Names) {
    $src = Join-Path $PSScriptRoot $name
    $dst = Join-Path $mods $name
    if (-not (Test-Path $src)) { throw "source not found: $src" }
    if (-not (Get-ChildItem -Path $src -Filter *.modinfo -File)) { throw "no .modinfo in $src" }
    Copy-Mirror $src $dst "installed to" @("/XD", "dlc")

    # Binary art packages (<Mod>\dlc\<Group>\<Group>.dep + Platforms\Windows\BLPs) are only
    # found by the game inside its own install, under DLC\. Mirror each one there.
    $dlcSrc = Join-Path $src "dlc"
    if (Test-Path $dlcSrc) {
        foreach ($group in Get-ChildItem -Path $dlcSrc -Directory) {
            if (-not (Get-ChildItem -Path $group.FullName -Filter *.dep -File)) { continue }
            if (-not $gameDlc) { Write-Host "  art package $($group.Name) not installed: game DLC folder not found (set CIV7_GAME_ROOT)"; continue }
            Copy-Mirror $group.FullName (Join-Path $gameDlc $group.Name) "  art package installed to" @()
        }
    }
}

Write-Host "`nRestart the game; it reads mods only at startup. To undo: .\uninstall.ps1"
exit $failed
