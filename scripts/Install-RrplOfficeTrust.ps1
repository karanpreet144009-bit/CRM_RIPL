[CmdletBinding()]
param(
  [string]$ServerIp = '10.119.146.7',
  [string]$HostName = 'erp.rrpl.local',
  [string]$RootCertificatePath
)

if ([string]::IsNullOrWhiteSpace($RootCertificatePath)) {
  $RootCertificatePath = Join-Path $PSScriptRoot '..\certs\rrpl-office-root-ca.pem'
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run PowerShell as Administrator, then run this script again.'
}

if (-not (Test-Path -LiteralPath $RootCertificatePath)) {
  throw "Office root certificate was not found: $RootCertificatePath"
}

$hostsPath = Join-Path $env:WINDIR 'System32\drivers\etc\hosts'
$entry = "$ServerIp`t$HostName"
$existing = Get-Content -LiteralPath $hostsPath -ErrorAction Stop
$hostPattern = "(?i)\s+$([regex]::Escape($HostName))(\s|$)"
$withoutPreviousEntry = $existing | Where-Object { $_ -notmatch $hostPattern }
Set-Content -LiteralPath $hostsPath -Value $withoutPreviousEntry
Add-Content -LiteralPath $hostsPath -Value $entry

Import-Certificate -FilePath $RootCertificatePath -CertStoreLocation 'Cert:\LocalMachine\Root' | Out-Null
if (-not (Get-NetFirewallRule -DisplayName 'RRPL ERP HTTPS' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'RRPL ERP HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Profile Private | Out-Null
}
Clear-DnsClientCache
Write-Host "Office trust installed. Open https://$HostName after the ERP HTTPS service is running."
