param(
  [string]$Version = "",
  [ValidateSet("stable", "beta", "emergency")]
  [string]$Channel = "stable",
  [string]$MinNativeVersion = "1.0",
  [string]$MaxNativeVersion = "",
  [int]$RolloutPercent = 100,
  [switch]$Mandatory,
  [switch]$Draft,
  [string]$Notes = "Bundle OTA publicado desde script",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib-release.ps1"

$root = Get-RepoRoot
$config = Get-ReleaseConfig -RepoRoot $root
$appDir = Join-Path $root "app-chofer"
$dist = Join-Path $appDir "dist"

if (-not $Version) {
  $Version = (Get-Date).ToString("yyyy.MM.dd.HHmm")
}

if (-not $SkipBuild) {
  Invoke-Checked -WorkingDirectory $appDir -Command "npm run build"
}

$zip = Join-Path $root "chofer-ota-$Version.zip"
$zipPath = New-DistZip -DistPath $dist -ZipPath $zip
$sha = Get-Sha256 -Path $zipPath
$token = Get-AdminToken -ApiUrl $config.ApiUrl -Username $config.AdminUser -Password $config.AdminPassword
$headers = @{ Authorization = "Bearer $token" }

$payload = @{
  platform = "android"
  channel = $Channel
  version_web = $Version
  min_native_version = $MinNativeVersion
  max_native_version = $MaxNativeVersion
  rollout_percent = $RolloutPercent
  obligatorio = [bool]$Mandatory
  notas = $Notes
  sha256 = $sha
  zip_base64 = Convert-FileToBase64 -Path $zipPath
} | ConvertTo-Json -Depth 6

$release = Invoke-RestMethod -Uri "$($config.ApiUrl)/app-updates/chofer/releases" -Method Post -ContentType "application/json" -Headers $headers -Body $payload
Write-Host "Bundle OTA creado: release #$($release.id), version $Version" -ForegroundColor Green

if (-not $Draft) {
  $statusPayload = @{
    estado = "ACTIVE"
    rollout_percent = $RolloutPercent
    obligatorio = [bool]$Mandatory
  } | ConvertTo-Json
  $release = Invoke-RestMethod -Uri "$($config.ApiUrl)/app-updates/chofer/releases/$($release.id)/status" -Method Post -ContentType "application/json" -Headers $headers -Body $statusPayload
  Write-Host "Bundle OTA activado: $($release.version_web) canal $Channel rollout $RolloutPercent%" -ForegroundColor Green
} else {
  Write-Host "Bundle queda en DRAFT. Activar desde backoffice o endpoint status." -ForegroundColor Yellow
}

Write-Host "ZIP: $zipPath"
$release | ConvertTo-Json -Depth 6
