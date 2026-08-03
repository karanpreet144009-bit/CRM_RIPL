[CmdletBinding()]
param()

$projectRoot = Split-Path -Parent $PSScriptRoot
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$npx = 'C:\Program Files\nodejs\npx.cmd'
$npm = 'C:\Program Files\nodejs\npm.cmd'
$logsPath = Join-Path $projectRoot 'logs'
$nginxConfig = Join-Path $projectRoot 'nginx\office-local.conf'
$certDirectory = Join-Path $projectRoot 'certs'
New-Item -ItemType Directory -Force $logsPath | Out-Null

# Use the active default network route so the HTTPS gateway always follows Wi-Fi/LAN changes.
$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1
$serverIp = (Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254*' } | Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $serverIp) { throw 'No active office IPv4 address was found.' }

& $docker info *> $null
if ($LASTEXITCODE -ne 0) {
  $dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dockerDesktop) { Start-Process -FilePath $dockerDesktop -WindowStyle Hidden }
}
for ($attempt = 0; $attempt -lt 24; $attempt++) {
  & $docker info *> $null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 10
}
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not ready. Start Docker Desktop and run this script again.' }

# Renew the local office certificate for the current IP when mkcert is available.
$mkcert = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\FiloSottile.mkcert_*\mkcert.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if ($mkcert) { & $mkcert -cert-file (Join-Path $certDirectory 'fullchain.pem') -key-file (Join-Path $certDirectory 'privkey.pem') erp.rrpl.local $serverIp | Out-Null }

$config = Get-Content -LiteralPath $nginxConfig -Raw
$config = [regex]::Replace($config, 'proxy_pass http://[0-9.]+:4000;', "proxy_pass http://${serverIp}:4000;")
$config = [regex]::Replace($config, 'proxy_pass http://[0-9.]+:5173;', "proxy_pass http://${serverIp}:5173;")
Set-Content -LiteralPath $nginxConfig -Value $config

Push-Location $projectRoot
try {
  & $docker compose up -d postgres | Out-Null
  $gateway = & $docker ps -q --filter name=rrpl-office-https
  if (-not $gateway) {
    & $docker run -d --name rrpl-office-https --restart unless-stopped -p 80:80 -p 443:443 -v "${projectRoot}\nginx\office-local.conf:/etc/nginx/conf.d/default.conf:ro" -v "${projectRoot}\certs:/etc/nginx/certs:ro" nginx:1.27-alpine | Out-Null
  } else { & $docker start rrpl-office-https *> $null }
  & $docker exec rrpl-office-https nginx -s reload *> $null

  # Always restart the API so installed updates are live after this command.
  $apiListener = Get-NetTCPConnection -State Listen -LocalPort 4000 -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($apiListener) { Stop-Process -Id $apiListener.OwningProcess -ErrorAction Stop }
  & $npx prisma generate --schema apps/api/prisma/schema.prisma | Out-Null
  Start-Process -FilePath $npx -ArgumentList 'tsx','apps/api/src/server.ts' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logsPath 'api.out.log') -RedirectStandardError (Join-Path $logsPath 'api.error.log')
  if (-not (Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $npm -ArgumentList 'run','dev','-w','@rrpl/web','--','--host','0.0.0.0' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logsPath 'web.out.log') -RedirectStandardError (Join-Path $logsPath 'web.error.log')
  }
} finally { Pop-Location }

Write-Host "RRPL ERP started. Open https://$serverIp"
