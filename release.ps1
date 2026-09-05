# Bump the mod version, install it into the game, and write a new versioned zip to share.
# Usage: .\release.ps1            (bumps 1 -> 2 -> 3 ...)
#        .\release.ps1 -NoBump    (rebuild the zip for the current version)
param([switch]$NoBump)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mod = Join-Path $root "EuropeMediterranean"
$modinfo = Join-Path $mod "europe-mediterranean.modinfo"
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

& (Join-Path $root "install.ps1") | Select-Object -Last 1

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$zip = Join-Path $root ("EuropeMediterranean-v{0}-{1}.zip" -f $version, $stamp)
Compress-Archive -Path $mod -DestinationPath $zip -Force
"mod version $version"
"zip: $zip ($((Get-Item $zip).Length) bytes)"
"md5: " + (Get-FileHash -Algorithm MD5 -Path $zip).Hash
