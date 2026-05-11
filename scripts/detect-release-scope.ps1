param(
  [string]$BaseRef = "",
  [string]$HeadRef = "HEAD",
  [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

function Write-ReleaseOutput {
  param([string]$Name, [string]$Value)
  Write-Host "$Name=$Value"
  if ($OutputFile) {
    Add-Content -LiteralPath $OutputFile -Value "$Name=$Value"
  } elseif ($env:GITHUB_OUTPUT) {
    Add-Content -LiteralPath $env:GITHUB_OUTPUT -Value "$Name=$Value"
  }
}

if (-not $BaseRef) {
  try {
    $BaseRef = (git rev-parse "$HeadRef^").Trim()
  } catch {
    $BaseRef = (git rev-list --max-parents=0 $HeadRef | Select-Object -First 1).Trim()
  }
}

$changedFiles = @(git diff --name-only $BaseRef $HeadRef | Where-Object { $_ -and $_.Trim() })
if ($changedFiles.Count -eq 0 -and $HeadRef -eq "HEAD") {
  $changedFiles = @(git status --porcelain | ForEach-Object {
    $line = $_
    if ($line.Length -ge 4) { $line.Substring(3).Trim() }
  } | Where-Object { $_ -and $_.Trim() })
}
if ($changedFiles.Count -eq 0) {
  Write-ReleaseOutput "changed_files" ""
  Write-ReleaseOutput "backend_changed" "false"
  Write-ReleaseOutput "frontend_changed" "false"
  Write-ReleaseOutput "landing_changed" "false"
  Write-ReleaseOutput "chofer_web_changed" "false"
  Write-ReleaseOutput "chofer_native_changed" "false"
  Write-ReleaseOutput "core_changed" "false"
  Write-ReleaseOutput "publish_ota" "false"
  Write-ReleaseOutput "publish_apk" "false"
  Write-ReleaseOutput "deploy_cloudrun" "false"
  exit 0
}

function Test-AnyMatch {
  param([string[]]$Patterns)
  foreach ($file in $changedFiles) {
    $normalized = $file -replace "\\", "/"
    foreach ($pattern in $Patterns) {
      if ($normalized -like $pattern) { return $true }
    }
  }
  return $false
}

$backendChanged = Test-AnyMatch @("backend/*", "Dockerfile", "cloudbuild.yaml", ".gcloudignore")
$frontendChanged = Test-AnyMatch @("frontend/*")
$landingChanged = Test-AnyMatch @("landing-saas/*")
$choferNativeChanged = Test-AnyMatch @(
  "app-chofer/android/*",
  "app-chofer/capacitor.config.*",
  "app-chofer/package.json",
  "app-chofer/package-lock.json",
  "app-chofer/patches/*"
)
$choferWebChanged = Test-AnyMatch @(
  "app-chofer/src/*",
  "app-chofer/public/*",
  "app-chofer/index.html",
  "app-chofer/vite.config.*",
  "app-chofer/tsconfig*"
)
$releaseInfraChanged = Test-AnyMatch @(
  ".github/workflows/*",
  "scripts/publish-*",
  "scripts/deploy-cloudrun.ps1",
  "scripts/build-component.ps1",
  "scripts/lib-release.ps1",
  "scripts/detect-release-scope.ps1"
)

$coreChanged = $backendChanged -or $frontendChanged -or $landingChanged
$publishApk = $choferNativeChanged
$publishOta = $choferWebChanged -and -not $choferNativeChanged
$deployCloudRun = $coreChanged

Write-ReleaseOutput "changed_files" (($changedFiles -join ",") -replace "`r|`n", "")
Write-ReleaseOutput "backend_changed" ($backendChanged.ToString().ToLowerInvariant())
Write-ReleaseOutput "frontend_changed" ($frontendChanged.ToString().ToLowerInvariant())
Write-ReleaseOutput "landing_changed" ($landingChanged.ToString().ToLowerInvariant())
Write-ReleaseOutput "chofer_web_changed" ($choferWebChanged.ToString().ToLowerInvariant())
Write-ReleaseOutput "chofer_native_changed" ($choferNativeChanged.ToString().ToLowerInvariant())
Write-ReleaseOutput "release_infra_changed" ($releaseInfraChanged.ToString().ToLowerInvariant())
Write-ReleaseOutput "core_changed" ($coreChanged.ToString().ToLowerInvariant())
Write-ReleaseOutput "publish_ota" ($publishOta.ToString().ToLowerInvariant())
Write-ReleaseOutput "publish_apk" ($publishApk.ToString().ToLowerInvariant())
Write-ReleaseOutput "deploy_cloudrun" ($deployCloudRun.ToString().ToLowerInvariant())
