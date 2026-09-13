# Removes the mods installed by install.ps1: the mod folders under the Civilization VII Mods
# folder, and the binary art packages mirrored into the game install's DLC\ folder.
# Nothing else is touched - a DLC folder is only removed when the repository has an art package
# group of that name AND the installed folder carries the matching .dep, so shipped game content
# can never be deleted by accident.
# Restart the game afterwards; it re-reads mods only at startup.
# Usage: .\uninstall.ps1                  (every mod in this repository)
#        .\uninstall.ps1 Byzantium ...    (only the named mod folders)
#        .\uninstall.ps1 -DryRun          (list what would be removed, remove nothing)
param([string[]]$Names, [switch]$DryRun)

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

$prefix = if ($DryRun) { "would remove" } else { "removed" }

foreach ($name in $Names) {
    $src = Join-Path $PSScriptRoot $name
    if (-not (Test-Path $src)) { throw "source not found: $src (name it as it appears in this repository)" }

    # The mod folder itself.
    $dst = Join-Path $mods $name
    if (Test-Path $dst) {
        if (-not $DryRun) { Remove-Item -LiteralPath $dst -Recurse -Force }
        Write-Host "$prefix $dst"
    } else {
        Write-Host "not installed: $dst"
    }

    # Art packages mirrored into the game install. Only groups this repository declares, and only
    # when the installed copy carries the same .dep file, so shipped DLC is never a target.
    $dlcSrc = Join-Path $src "dlc"
    if (Test-Path $dlcSrc) {
        foreach ($group in Get-ChildItem -Path $dlcSrc -Directory) {
            $dep = Get-ChildItem -Path $group.FullName -Filter *.dep -File | Select-Object -First 1
            if (-not $dep) { continue }
            if (-not $gameDlc) { Write-Host "  art package $($group.Name) skipped: game DLC folder not found (set CIV7_GAME_ROOT)"; continue }
            $gdst = Join-Path $gameDlc $group.Name
            if (-not (Test-Path $gdst)) { Write-Host "  art package not installed: $gdst"; continue }
            if (-not (Test-Path (Join-Path $gdst $dep.Name))) {
                Write-Host "  REFUSED $gdst : no $($dep.Name) inside, this is not our package"
                continue
            }
            if (-not $DryRun) { Remove-Item -LiteralPath $gdst -Recurse -Force }
            Write-Host "  $prefix art package $gdst"
        }
    }
}

if ($DryRun) { Write-Host "`n(dry run - nothing was deleted)" }
