param(
  [ValidateSet("all", "backend", "frontend", "landing", "chofer")]
  [string]$Target = "all",
  [switch]$SkipLocalBuild,
  [string]$ProjectId = "",
  [string]$Region = "",
  [string]$Config = "cloudbuild.yaml"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib-release.ps1"

$root = Get-RepoRoot
$releaseConfig = Get-ReleaseConfig -RepoRoot $root
if (-not $ProjectId) { $ProjectId = $releaseConfig.ProjectId }
if (-not $Region) { $Region = $releaseConfig.Region }

if (-not $SkipLocalBuild) {
  switch ($Target) {
    "backend" { & "$PSScriptRoot\build-component.ps1" -Target backend }
    "frontend" { & "$PSScriptRoot\build-component.ps1" -Target frontend }
    "landing" { & "$PSScriptRoot\build-component.ps1" -Target landing }
    "chofer" { & "$PSScriptRoot\build-component.ps1" -Target app-chofer }
    default { & "$PSScriptRoot\build-component.ps1" -Target all }
  }
}

Write-Host "Desplegando Cloud Run con Cloud Build..." -ForegroundColor Cyan
Write-Host "Proyecto: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Target solicitado: $Target (la imagen Docker contiene backend + front + chofer + landing)"

Push-Location $root
try {
  $buildArgs = @("builds", "submit", "--config", $Config, "--project", $ProjectId, "--substitutions", "_REGION=$Region")
  if ($env:GITHUB_ACTIONS -eq "true") {
    $buildArgs += "--suppress-logs"
  }
  & $releaseConfig.Gcloud @buildArgs
  if ($LASTEXITCODE -ne 0) { throw "Cloud Build fallo con codigo $LASTEXITCODE" }
  & $releaseConfig.Gcloud run services describe transportadora --region $Region --project $ProjectId --format "value(status.url,status.latestReadyRevisionName)"
} finally {
  Pop-Location
}
