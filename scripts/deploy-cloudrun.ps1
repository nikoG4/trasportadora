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
    $buildArgs += @("--async", "--format", "value(id)")
    $buildId = ((& $releaseConfig.Gcloud @buildArgs) | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $buildId) { throw "No se pudo iniciar Cloud Build" }
    Write-Host "Cloud Build iniciado: $buildId"
    do {
      Start-Sleep -Seconds 10
      $status = ((& $releaseConfig.Gcloud builds describe $buildId --project $ProjectId --format "value(status)") | Select-Object -Last 1).Trim()
      Write-Host "Cloud Build status: $status"
    } while ($status -in @("QUEUED", "WORKING", "PENDING"))
    if ($status -ne "SUCCESS") { throw "Cloud Build termino con estado $status" }
  } else {
    & $releaseConfig.Gcloud @buildArgs
    if ($LASTEXITCODE -ne 0) { throw "Cloud Build fallo con codigo $LASTEXITCODE" }
  }
  & $releaseConfig.Gcloud run services describe transportadora --region $Region --project $ProjectId --format "value(status.url,status.latestReadyRevisionName)"
} finally {
  Pop-Location
}
