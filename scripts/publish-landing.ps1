param([switch]$SkipLocalBuild)

$ErrorActionPreference = "Stop"
& "$PSScriptRoot\deploy-cloudrun.ps1" -Target landing -SkipLocalBuild:$SkipLocalBuild
