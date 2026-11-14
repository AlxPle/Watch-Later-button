param (
    [int]$Port = 9222,
    [string]$TargetUrl = "https://www.youtube.com"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ExtDir = Join-Path $RootDir "dist\chrome"

if (-not (Test-Path $ExtDir)) {
    Write-Host "[info] Building extension into dist/chrome..." -ForegroundColor Cyan
    node "$ScriptDir\build.mjs" --no-zip
}

function Find-Chrome {
    $candidates = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            return $cand
        }
    }
    return $null
}

$ChromeBin = Find-Chrome
if (-not $ChromeBin) {
    Write-Error "Google Chrome executable was not found in standard paths."
    exit 1
}

$UserDataDir = Join-Path $env:TEMP "wlb-chrome-debug-profile"
if (-not (Test-Path $UserDataDir)) {
    New-Item -ItemType Directory -Path $UserDataDir -Force | Out-Null
}

Write-Host "[info] Starting Chrome in debug mode on port $Port..." -ForegroundColor Green
Write-Host "  Chrome: $ChromeBin"
Write-Host "  Profile: $UserDataDir"
Write-Host "  Extension: $ExtDir"

Start-Process -FilePath $ChromeBin -ArgumentList @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=$UserDataDir",
    "--disable-extensions-except=$ExtDir",
    "--load-extension=$ExtDir",
    "--no-first-run",
    "--no-default-browser-check",
    $TargetUrl
)
