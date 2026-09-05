$large = Get-Content -Path "$PSScriptRoot\..\maps\europe-large-geo.js" -Raw -Encoding UTF8
$std = Get-Content -Path "$PSScriptRoot\..\maps\europe-geo.js" -Raw -Encoding UTF8
$largeClean = $large -replace '(?m)^export const GEO\b', 'window.DEFAULT_EUROPE_LARGE_GEO'
$stdClean = $std -replace '(?m)^export const GEO\b', 'window.DEFAULT_EUROPE_GEO'
$header = "// default-maps.js`r`n// Preloaded map data for standalone and fallback use`r`n`r`n"
$out = [string]::Concat($header, $largeClean, "`r`n`r`n", $stdClean)
New-Item -ItemType Directory -Force -Path "$PSScriptRoot\js" | Out-Null
[System.IO.File]::WriteAllText("$PSScriptRoot\js\default-maps.js", $out, [System.Text.Encoding]::UTF8)
Write-Host "Created default-maps.js, size:" (Get-Item "$PSScriptRoot\js\default-maps.js").Length
