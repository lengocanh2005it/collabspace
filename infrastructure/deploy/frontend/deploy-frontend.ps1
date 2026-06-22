$ErrorActionPreference = "Stop"

$frontendDir = "..\..\..\..\collabspace-fe"
$deployDir = $PSScriptRoot

Write-Host "Building frontend for production..."
Set-Content "$frontendDir\.env.production" -Value "VITE_API_BASE_URL=/api/v1"
Push-Location $frontendDir
npm run build
Pop-Location

Write-Host "Compressing frontend build..."
if (Test-Path "$deployDir\frontend.tar.gz") { Remove-Item "$deployDir\frontend.tar.gz" -Force }
Push-Location "$frontendDir\dist"
tar.exe -czf "$deployDir\frontend.tar.gz" *
Pop-Location

Write-Host "Creating Nginx configuration..."
$nginxConf = @"
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files `$uri `$uri/ /index.html;
    }
}
"@
Set-Content "$deployDir\default.conf" -Value $nginxConf

Write-Host "Deploying to Kubernetes..."
kubectl delete configmap frontend-payload nginx-conf -n collabspace --ignore-not-found
kubectl create configmap frontend-payload --from-file=frontend.tar.gz="$deployDir\frontend.tar.gz" -n collabspace
kubectl create configmap nginx-conf --from-file=default.conf="$deployDir\default.conf" -n collabspace

kubectl apply -f "$deployDir\frontend-deployment.yaml"

Write-Host "Cleaning up temporary files..."
Remove-Item "$deployDir\frontend.tar.gz" -Force
Remove-Item "$deployDir\default.conf" -Force

Write-Host "Deployment successful!"
