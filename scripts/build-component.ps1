param(
  [ValidateSet("backend", "frontend", "app-chofer", "landing", "all")]
  [string]$Target = "all",
  [switch]$CapSync,
  [switch]$Apk
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib-release.ps1"

$root = Get-RepoRoot

function Build-One {
  param([string]$Name, [string]$Dir)
  Invoke-Checked -WorkingDirectory (Join-Path $root $Dir) -Command "npm run build"
}

if ($Target -eq "all" -or $Target -eq "backend") { Build-One "backend" "backend" }
if ($Target -eq "all" -or $Target -eq "frontend") { Build-One "frontend" "frontend" }
if ($Target -eq "all" -or $Target -eq "app-chofer") {
  Build-One "app-chofer" "app-chofer"
  if ($CapSync -or $Apk) {
    Invoke-Checked -WorkingDirectory (Join-Path $root "app-chofer") -Command "npx cap sync android"
  }
  if ($Apk) {
    Invoke-Checked -WorkingDirectory (Join-Path $root "app-chofer\android") -Command "gradlew.bat assembleDebug"
  }
}
if ($Target -eq "all" -or $Target -eq "landing") { Build-One "landing" "landing-saas" }

Write-Host "Build finalizado: $Target" -ForegroundColor Green
