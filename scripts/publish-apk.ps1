param(
  [string]$Version = "",
  [string]$MinSupportedVersion = "1.0",
  [switch]$Mandatory,
  [string]$Notes = "APK publicada desde script",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib-release.ps1"

$root = Get-RepoRoot
$config = Get-ReleaseConfig -RepoRoot $root
$appDir = Join-Path $root "app-chofer"
$gradleFile = Join-Path $appDir "android\app\build.gradle"

if (-not $Version) {
  $current = (Select-String -LiteralPath $gradleFile -Pattern 'versionName\s+"([^"]+)"').Matches.Groups[1].Value
  if (-not $current) { $current = "1.0.0" }
  $parts = $current.Split(".") | ForEach-Object { [int]$_ }
  while ($parts.Count -lt 3) { $parts += 0 }
  $parts[2] = $parts[2] + 1
  $Version = ($parts -join ".")
}

$gradle = Get-Content -LiteralPath $gradleFile -Raw
$currentCode = [int]((Select-String -LiteralPath $gradleFile -Pattern 'versionCode\s+(\d+)').Matches.Groups[1].Value)
if (-not $currentCode) { $currentCode = 1 }
$gradle = $gradle -replace 'versionCode\s+\d+', "versionCode $($currentCode + 1)"
$gradle = $gradle -replace 'versionName\s+"[^"]+"', "versionName `"$Version`""
[IO.File]::WriteAllText($gradleFile, $gradle, [Text.UTF8Encoding]::new($false))

$otaFile = Join-Path $appDir "src\otaUpdates.ts"
if (Test-Path -LiteralPath $otaFile) {
  $ota = Get-Content -LiteralPath $otaFile -Raw
  $ota = $ota -replace "const FALLBACK_NATIVE_VERSION = '[^']+';", "const FALLBACK_NATIVE_VERSION = '$Version';"
  [IO.File]::WriteAllText($otaFile, $ota, [Text.UTF8Encoding]::new($false))
}

if (-not $SkipBuild) {
  Invoke-Checked -WorkingDirectory $appDir -Command "npm run build"
  Invoke-Checked -WorkingDirectory $appDir -Command "npx cap sync android"
  Invoke-Checked -WorkingDirectory (Join-Path $appDir "android") -Command "gradlew.bat assembleDebug"
}

$apk = Join-Path $appDir "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) { throw "No existe APK: $apk" }

$token = Get-AdminToken -ApiUrl $config.ApiUrl -Username $config.AdminUser -Password $config.AdminPassword
$payload = @{
  latest_native_version = $Version
  min_supported_native_version = $MinSupportedVersion
  obligatorio = [bool]$Mandatory
  notas = $Notes
  apk_base64 = Convert-FileToBase64 -Path $apk
} | ConvertTo-Json -Depth 5

$headers = @{ Authorization = "Bearer $token" }
$result = Invoke-RestMethod -Uri "$($config.ApiUrl)/app-updates/chofer/native" -Method Post -ContentType "application/json" -Headers $headers -Body $payload

Write-Host "APK publicada: v$Version" -ForegroundColor Green
Write-Host "Archivo: $apk"
Write-Host "URL: $($result.apk_url)"
$result | ConvertTo-Json -Depth 5
