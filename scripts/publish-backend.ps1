param([switch]$SkipLocalBuild)

$ErrorActionPreference = "Stop"
& "$PSScriptRoot\deploy-cloudrun.ps1" -Target backend -SkipLocalBuild:$SkipLocalBuild
