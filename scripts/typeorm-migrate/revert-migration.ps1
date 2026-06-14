#!/usr/bin/env pwsh
param(
  [Parameter(Mandatory = $true)][ValidateSet('auth', 'user', 'workspace')][string]$Service
)
$Root = Resolve-Path (Join-Path $PSScriptRoot '../..')
$ServiceDir = Join-Path $Root "services/$Service-service"
Push-Location $ServiceDir
try { pnpm run migrate:revert } finally { Pop-Location }
