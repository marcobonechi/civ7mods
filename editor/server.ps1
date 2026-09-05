# server.ps1
# Zero-dependency local companion server for Civilization VII Map Editor.
# Runs on built-in Windows PowerShell / .NET HttpListener.

param(
    [int]$Port = 8080,
    [switch]$NoOpen
)

$root = $PSScriptRoot
$civ7Root = Split-Path -Parent $root
if ($civ7Root -match "EuropeMediterranean") {
    $civ7Root = Split-Path -Parent $civ7Root
}

$mapsDir1 = Join-Path $civ7Root "EuropeMediterranean\maps"
$mapsDir2 = Join-Path $civ7Root "EuropeMediterranean - Copy\maps"
$previewScript = Join-Path $civ7Root "preview\build-preview.ps1"
$installScript = Join-Path $civ7Root "install.ps1"

# Try binding to port
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    $Port = 8081
    $prefix = "http://localhost:$Port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Civ VII Visual Map Editor Server Started" -ForegroundColor Yellow
Write-Host "  URL: $prefix" -ForegroundColor Green
Write-Host "  Press Ctrl+C in this console to stop the server" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not $NoOpen) {
    Start-Process $prefix
}

function Get-MimeType([string]$path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        default { return "application/octet-stream" }
    }
}

try {
    while ($listener.IsListening) {
        $context = $null
        try {
            $context = $listener.GetContext()
        } catch {
            break
        }

        try {
            $request = $context.Request
            $response = $context.Response

            # Add CORS headers
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            $urlPath = $request.Url.AbsolutePath
            
            # REST API Routes
            if ($urlPath -eq "/api/status") {
                $json = '{"status":"ok","version":"1.0.0"}'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.ContentType = "application/json; charset=utf-8"
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            if ($urlPath -eq "/api/save" -and $request.HttpMethod -eq "POST") {
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $body = $reader.ReadToEnd()
                    $data = ConvertFrom-Json $body
                    
                    $filename = [System.IO.Path]::GetFileName($data.filename)
                    $content = $data.content

                    # Write to primary EuropeMediterranean maps
                    if (Test-Path $mapsDir1) {
                        $target1 = Join-Path $mapsDir1 $filename
                        [System.IO.File]::WriteAllText($target1, $content, (New-Object System.Text.UTF8Encoding($false)))
                    }
                    # Write to mirror EuropeMediterranean - Copy maps
                    if (Test-Path $mapsDir2) {
                        $target2 = Join-Path $mapsDir2 $filename
                        [System.IO.File]::WriteAllText($target2, $content, (New-Object System.Text.UTF8Encoding($false)))
                    }

                    Write-Host "[SAVE] Saved $filename to mod folders" -ForegroundColor Green
                    $respJson = '{"success":true,"message":"File saved to maps directory"}'
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                } catch {
                    Write-Host "[ERROR] Save failed: $_" -ForegroundColor Red
                    $respJson = '{"success":false,"error":"' + $_.Exception.Message.Replace('\','\\').Replace('"','\"') + '"}'
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                    $response.StatusCode = 500
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
                $response.Close()
                continue
            }

            if ($urlPath -eq "/api/build-preview" -and $request.HttpMethod -eq "POST") {
                try {
                    Write-Host "[PREVIEW] Running build-preview.ps1..." -ForegroundColor Yellow
                    $output = powershell -ExecutionPolicy Bypass -File $previewScript 2>&1 | Out-String
                    $respObj = @{ success = $true; output = $output }
                    $respJson = ConvertTo-Json $respObj
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                } catch {
                    $respObj = @{ success = $false; error = $_.Exception.Message }
                    $respJson = ConvertTo-Json $respObj
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                    $response.StatusCode = 500
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
                $response.Close()
                continue
            }

            if ($urlPath -eq "/api/install" -and $request.HttpMethod -eq "POST") {
                try {
                    Write-Host "[INSTALL] Running install.ps1..." -ForegroundColor Yellow
                    $output = powershell -ExecutionPolicy Bypass -File $installScript 2>&1 | Out-String
                    $respObj = @{ success = $true; output = $output }
                    $respJson = ConvertTo-Json $respObj
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                } catch {
                    $respObj = @{ success = $false; error = $_.Exception.Message }
                    $respJson = ConvertTo-Json $respObj
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                    $response.StatusCode = 500
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
                $response.Close()
                continue
            }

            # Static File Serving
            $rel = $urlPath.TrimStart('/')
            if ($rel -eq "" -or $rel -eq "index.html") { $rel = "index.html" }
            $filePath = Join-Path $root $rel

            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = Get-MimeType $filePath
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $notFound = [System.Text.Encoding]::UTF8.GetBytes("File Not Found")
                $response.OutputStream.Write($notFound, 0, $notFound.Length)
            }
            try { $response.Close() } catch {}
        } catch {
            if ($context -and $context.Response) {
                try { $context.Response.Close() } catch {}
            }
        }
    }
} finally {
    if ($listener) { $listener.Stop() }
}
