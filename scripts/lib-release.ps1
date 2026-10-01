param()

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  param([string]$Start = (Get-Location).Path)
  $dir = Get-Item -LiteralPath $Start
  while ($dir -and -not (Test-Path -LiteralPath (Join-Path $dir.FullName "package.json"))) {
    $dir = $dir.Parent
  }
  if (-not $dir) { throw "No se encontro package.json raiz." }
  return $dir.FullName
}

function Get-ReleaseConfig {
  param([string]$RepoRoot)

  $apiUrl = $env:TRANSPORTADORA_API_URL
  if (-not $apiUrl) { throw "Define TRANSPORTADORA_API_URL en el entorno." }

  $adminUser = $env:TRANSPORTADORA_ADMIN_USER
  if (-not $adminUser) { throw "Define TRANSPORTADORA_ADMIN_USER en el entorno." }

  $adminPassword = $env:TRANSPORTADORA_ADMIN_PASSWORD
  if (-not $adminPassword) { throw "Define TRANSPORTADORA_ADMIN_PASSWORD en el entorno." }

  $projectId = $env:GCLOUD_PROJECT_ID
  if (-not $projectId) { throw "Define GCLOUD_PROJECT_ID en el entorno." }

  $region = $env:GCLOUD_REGION
  if (-not $region) { $region = "us-central1" }

  $gcloud = $env:GCLOUD_CMD
  if (-not $gcloud) { $gcloud = "gcloud" }

  return @{
    ApiUrl = $apiUrl.TrimEnd("/")
    AdminUser = $adminUser
    AdminPassword = $adminPassword
    ProjectId = $projectId
    Region = $region
    Gcloud = $gcloud
    RepoRoot = $RepoRoot
  }
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory
  )
  Write-Host ">> $Command" -ForegroundColor Cyan
  Push-Location $WorkingDirectory
  try {
    cmd /c $Command
    if ($LASTEXITCODE -ne 0) { throw "Fallo comando ($LASTEXITCODE): $Command" }
  } finally {
    Pop-Location
  }
}

function Get-AdminToken {
  param(
    [Parameter(Mandatory = $true)][string]$ApiUrl,
    [Parameter(Mandatory = $true)][string]$Username,
    [Parameter(Mandatory = $true)][string]$Password
  )
  $body = @{ username = $Username; password = $Password } | ConvertTo-Json
  $login = Invoke-RestMethod -Uri "$ApiUrl/login" -Method Post -ContentType "application/json" -Body $body
  if (-not $login.token) { throw "Login admin no devolvio token." }
  return $login.token
}

function Convert-FileToBase64 {
  param([Parameter(Mandatory = $true)][string]$Path)
  return [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path)))
}

function New-DistZip {
  param(
    [Parameter(Mandatory = $true)][string]$DistPath,
    [Parameter(Mandatory = $true)][string]$ZipPath
  )
  if (-not (Test-Path -LiteralPath (Join-Path $DistPath "index.html"))) {
    throw "El dist no contiene index.html: $DistPath"
  }
  if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
  Compress-Archive -Path (Join-Path $DistPath "*") -DestinationPath $ZipPath -Force
  return (Resolve-Path -LiteralPath $ZipPath).Path
}

function Get-Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
