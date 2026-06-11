$endpoints = @{
  auth         = "http://localhost:3000/api/v1/auth/health/ready"
  user         = "http://localhost:3001/api/v1/users/health/ready"
  workspace    = "http://localhost:3002/api/v1/workspaces/health/ready"
  task         = "http://localhost:3003/api/v1/tasks/health/ready"
  notification = "http://localhost:3004/api/v1/notifications/health/ready"
}

$failures = 0

foreach ($entry in $endpoints.GetEnumerator()) {
  try {
    $response = Invoke-WebRequest -Uri $entry.Value -UseBasicParsing -TimeoutSec 5
    $code = [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode.value__
    } else {
      $code = 0
    }
  }

  if ($code -eq 200) {
    Write-Host "[OK]   $($entry.Key) ($code) $($entry.Value)"
  } else {
    Write-Host "[FAIL] $($entry.Key) ($code) $($entry.Value)"
    $failures++
  }
}

if ($failures -gt 0) {
  Write-Error "Readiness drill failed: $failures service(s) not ready."
  exit 1
}

Write-Host "All services report ready."
