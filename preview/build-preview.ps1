# Rebuilds the two preview pages from the mod's geography files and (optionally) opens them.
#   .\build-preview.ps1            -> writes europe-large.html and europe.html next to this script
#   .\build-preview.ps1 -Open      -> also opens them in your default browser
# The pages are self-contained (data + rasterizer inlined), so they work from a file:// URL.
param([switch]$Open)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$maps = Join-Path (Split-Path -Parent $root) "EuropeMediterranean\maps"
$tpl  = Join-Path $root "templates"

function Strip-Exports([string]$file) {
    # the map files are ES modules; the preview inlines them, so drop the `export` keywords
    (Get-Content $file -Raw -Encoding UTF8) -replace '(?m)^export ', ''
}

function Build([string]$geo, [string]$tail, [string]$out) {
    $html = (Get-Content (Join-Path $tpl "head.html") -Raw -Encoding UTF8) +
            (Strip-Exports (Join-Path $maps $geo)) + "`n" +
            (Strip-Exports (Join-Path $maps "europe-raster.js")) +
            (Get-Content (Join-Path $tpl $tail) -Raw -Encoding UTF8)
    [System.IO.File]::WriteAllText((Join-Path $root $out), $html, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "built $out"
}

Build "europe-large-geo.js" "tail-large.html"    "europe-large.html"
Build "europe-geo.js"       "tail-standard.html" "europe.html"

if ($Open) {
    Start-Process (Join-Path $root "europe-large.html")
}
