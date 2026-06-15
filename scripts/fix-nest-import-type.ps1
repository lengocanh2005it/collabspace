$injectableTypes = @(
  'AuthGrpcService',
  'EmailsService',
  'AuthOutboxService',
  'RedisService',
  'TaskOutboxService',
  'IdempotencyService',
  'AzureBlobService',
  'MetricsService',
  'UserHealthService',
  'WorkspaceMembershipCacheService',
  'EmailsSenderService',
  'AuthHealthService',
  'CommandBus',
  'QueryBus',
  'JwtTokenService',
  'EmailVerificationOtpService',
  'AccessTokenVerifyLiteCacheService',
  'UserProfileHttpClient',
  'WorkspaceDeletionService',
  'TaskHealthService',
  'WorkspaceHealthService',
  'NotificationHealthService',
  'BroadcastJobService',
  'PasswordResetTokenService',
  'UserProfileResolverService',
  'SessionIssuanceService',
  'TaskCommentNotificationPublisher',
  'NotificationCountCacheService',
  'RabbitMqEventsService',
  'GraphileWorkerService',
  'WorkspaceOutboxService',
  'WorkspaceCacheService',
  'DatabaseService',
  'UserProfileCacheService',
  'AuthAdminHttpClient',
  'DataSource'
)

Get-ChildItem -Path "$PSScriptRoot\..\services" -Recurse -Filter *.ts |
  Where-Object {
    $_.FullName -match '\\src\\' -and
    $_.FullName -notmatch '\\dist\\' -and
    $_.Name -notmatch '\.(spec|e2e-spec|integration\.spec)\.ts$'
  } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($null -eq $content -or $content.Length -eq 0) { return }
    $updated = $content
    foreach ($type in $injectableTypes) {
      $updated = $updated -replace "import type \{ $type \}", "import { $type }"
      $updated = $updated -replace "import type \{ $type,", "import { $type,"
      $updated = $updated -replace ", type $type \}", ", $type }"
      $updated = $updated -replace ", type $type,", ", $type,"
      $updated = $updated -replace "\{ type $type,", "{ $type,"
    }
    if ($updated -ne $content) {
      Set-Content -Path $_.FullName -Value $updated -NoNewline
      Write-Output $_.FullName
    }
  }
