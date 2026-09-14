# Renders showcase screenshots of the large map from the preview page with headless Edge.
#   .\shots.ps1            -> writes PNGs into ..\EuropeMediterranean\screenshots (shipped with the mod, listed in its modinfo)
# Views are lon/lat boxes; the page's screenshot mode (?shot=1) frames them, see tail-large.html.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$page = "file:///" + ((Join-Path $root "europe-large.html") -replace '\\', '/')
$out = Join-Path (Split-Path -Parent $root) "EuropeMediterranean\screenshots"
New-Item -ItemType Directory -Force $out | Out-Null
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$profile = Join-Path $env:TEMP "edge-shots-profile"

# The two full-map views stay under 1 MiB (jj refuses larger new files).
$views = @(
    @{ name = "01-global";           cw = 1400; ch = 1076; q = "title=Europe, Mediterranean %26 Sahel (Large) - 112x98" },
    @{ name = "02-home-distant";     cw = 1400; ch = 1076; q = "regions=1&title=Home lands (west) and distant lands (east)" },
    @{ name = "03-france";           cw = 1600; ch = 1100; q = "view=-5,42,9,51.5&title=France" },
    @{ name = "04-italy";            cw = 1600; ch = 1100; q = "view=6,36,19,47&title=Italy" },
    @{ name = "05-greece";           cw = 1600; ch = 1100; q = "view=19,34.5,29,42&title=Greece and the Aegean" },
    @{ name = "06-ukraine";          cw = 1600; ch = 1100; q = "view=22,44,42,53&title=Ukraine and the Pontic steppe" },
    @{ name = "07-egypt";            cw = 1600; ch = 1100; q = "view=24,21,37,33&title=Egypt, the Nile and the Sinai" },
    @{ name = "08-africa-sea-lane";  cw = 1600; ch = 1100; q = "view=-24,4,14,26&title=West Africa - the sea lane around the continent" }
)

foreach ($v in $views) {
    $url = "${page}?shot=1&cw=$($v.cw)&ch=$($v.ch)&" + ($v.q -replace ' ', '%20')
    $png = Join-Path $out ($v.name + ".png")
    if (Test-Path $png) { Remove-Item -LiteralPath $png -Force }
    & $edge --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$profile" --virtual-time-budget=10000 --window-size="$($v.cw),$($v.ch)" --screenshot="$png" $url 2>$null | Out-Null
    if (Test-Path $png) { "wrote $png ($((Get-Item $png).Length) bytes)" } else { "FAILED $($v.name)" }
}
