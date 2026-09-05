# Bump one mod's version, install it into the game, and write a new versioned zip to share.
# Usage: .\release.ps1 <ModFolder>             (bumps 1 -> 2 -> 3 ...)
#        .\release.ps1 <ModFolder> -NoBump     (rebuild the zip for the current version)
# The folder argument may be omitted when the repository holds a single mod.
param([string]$Name, [switch]$NoBump)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Name) {
    $found = Get-ChildItem -Path $root -Directory |
        Where-Object { Get-ChildItem -Path $_.FullName -Filter *.modinfo -File } |
        ForEach-Object { $_.Name }
    if (@($found).Count -ne 1) { throw "usage: .\release.ps1 <ModFolder> [-NoBump]   (mods here: $($found -join ', '))" }
    $Name = $found
}
$mod = Join-Path $root $Name
$modinfo = (Get-ChildItem -Path $mod -Filter *.modinfo -File | Select-Object -First 1).FullName
if (-not $modinfo) { throw "no .modinfo in $mod" }
$enc = New-Object Text.UTF8Encoding $false

$xml = [IO.File]::ReadAllText($modinfo)
if ($xml -notmatch '<Version>(\d+)</Version>') { throw "no <Version> in $modinfo" }
$version = [int]$Matches[1]
if (-not $NoBump) {
    $version++
    $xml = $xml -replace '<Version>\d+</Version>', "<Version>$version</Version>"
    $xml = $xml -replace 'version="\d+"', "version=`"$version`""
    [IO.File]::WriteAllText($modinfo, $xml, $enc)
}

& (Join-Path $root "install.ps1") $Name | Select-Object -Last 1

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$zip = Join-Path $root ("{0}-v{1}-{2}.zip" -f $Name, $version, $stamp)
Compress-Archive -Path $mod -DestinationPath $zip -Force
"$Name version $version"
"zip: $zip ($((Get-Item $zip).Length) bytes)"
"md5: " + (Get-FileHash -Algorithm MD5 -Path $zip).Hash
