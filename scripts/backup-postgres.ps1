param([string]$BackupDirectory = "backups", [int]$RetentionDays = 30)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $BackupDirectory "rrpl-$timestamp.sql.gz"
docker compose exec -T postgres pg_dump -U rrpl -d rrpl_erp | gzip > $target
Get-ChildItem -Path $BackupDirectory -Filter "rrpl-*.sql.gz" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item
Write-Output "Backup written to $target"
