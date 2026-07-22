<#
.SYNOPSIS
    赛博命理 · Postgres 数据库备份脚本（Windows PowerShell）
.DESCRIPTION
    通过 pg_dump 导出 Postgres 数据库到带时间戳的 .sql.gz 文件。
    使用前请参照 docs/DEPLOY.md §备份与恢复 配置 PG* 环境变量。
.PARAMETER BackupDir
    备份输出目录，默认为脚本所在目录的 ../backups
.PARAMETER Format
    pg_dump 输出格式：plain（默认 .sql.gz）| custom（.dump）| directory
.EXAMPLE
    .\backup-postgres.example.ps1
    .\backup-postgres.example.ps1 -BackupDir "D:\db-backups" -Format custom
.NOTES
    依赖：pg_dump（PostgreSQL 客户端工具，需在 PATH 中）
    环境变量：PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE
    若未设置，脚本会提示你通过 $env: 或手动编辑本文件配置。
#>

param(
    [string]$BackupDir = "",
    [string]$Format = "plain"
)

$ErrorActionPreference = "Stop"

# ===== 配置区 ================================================================
# 方式 1：在脚本下方直接填写（勿提交含密码的副本到 Git）
# 方式 2：通过环境变量传入（推荐）
#   $env:PGHOST = "your-db-host.example.com"
#   $env:PGPORT = "5432"
#   $env:PGUSER = "cyber"
#   $env:PGPASSWORD = "your-strong-password"
#   $env:PGDATABASE = "cyber_divination"
# =============================================================================

$PG_HOST     = if ($env:PGHOST)     { $env:PGHOST }     else { "" }
$PG_PORT     = if ($env:PGPORT)     { $env:PGPORT }     else { "5432" }
$PG_USER     = if ($env:PGUSER)     { $env:PGUSER }     else { "" }
$PG_PASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "" }
$PG_DATABASE = if ($env:PGDATABASE) { $env:PGDATABASE } else { "cyber_divination" }

# ===== 参数验证 ==============================================================
$missing = @()
if (-not $PG_HOST)     { $missing += "PGHOST" }
if (-not $PG_USER)     { $missing += "PGUSER" }
if (-not $PG_PASSWORD) { $missing += "PGPASSWORD" }

if ($missing.Count -gt 0) {
    Write-Host "[backup] 缺少以下环境变量：" -ForegroundColor Yellow
    foreach ($m in $missing) {
        Write-Host "  - $m" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "请通过以下方式设置：" -ForegroundColor Cyan
    Write-Host '  $env:PGHOST = "your-db-host.example.com"' -ForegroundColor Cyan
    Write-Host '  $env:PGPORT = "5432"' -ForegroundColor Cyan
    Write-Host '  $env:PGUSER = "cyber"' -ForegroundColor Cyan
    Write-Host '  $env:PGPASSWORD = "your-strong-password"' -ForegroundColor Cyan
    Write-Host '  $env:PGDATABASE = "cyber_divination"' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "或编辑本脚本的配置区直接填写（勿提交含密码的副本到 Git）。" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "另可参照 compose.yaml 本地 DB 测试备份：" -ForegroundColor Cyan
    Write-Host '  $env:PGHOST = "localhost"; $env:PGPORT = "5432"; $env:PGUSER = "cyber"; $env:PGPASSWORD = "cyber"; $env:PGDATABASE = "cyber_divination"' -ForegroundColor Cyan
    exit 1
}

# ===== 检查 pg_dump ==========================================================
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Host "[backup] 未找到 pg_dump，请先安装 PostgreSQL 客户端工具并加入 PATH。" -ForegroundColor Red
    Write-Host "  下载：https://www.postgresql.org/download/" -ForegroundColor Cyan
    exit 1
}

# ===== 创建备份目录 ==========================================================
if (-not $BackupDir) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $BackupDir = Join-Path $scriptDir "..\backups"
}

if (-not (Test-Path -LiteralPath $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "[backup] 创建备份目录: $BackupDir" -ForegroundColor Green
}

# ===== 生成文件名 ============================================================
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$ext = switch ($Format) {
    "custom"    { ".dump" }
    "directory" { "" }
    default     { ".sql.gz" }
}
$fileName = "${PG_DATABASE}_${ts}${ext}"
$filePath = Join-Path $BackupDir $fileName

# ===== 构建 pg_dump 命令 =====================================================
$env:PGHOST     = $PG_HOST
$env:PGPORT     = $PG_PORT
$env:PGUSER     = $PG_USER
$env:PGPASSWORD = $PG_PASSWORD
$env:PGDATABASE = $PG_DATABASE

$dumpArgs = @(
    "-h", $PG_HOST,
    "-p", $PG_PORT,
    "-U", $PG_USER,
    "-d", $PG_DATABASE,
    "-w",                       # 不提示密码，使用 PGPASSWORD 环境变量
    "--no-owner",
    "--no-acl"
)

switch ($Format) {
    "custom" {
        $dumpArgs += "-Fc"
        $dumpArgs += "-f"
        $dumpArgs += $filePath
    }
    "directory" {
        $dumpArgs += "-Fd"
        $dumpArgs += "-f"
        $dumpArgs += $filePath
    }
    default {
        # plain 格式：通过管道压缩
        $dumpArgs += "-Fp"
    }
}

# ===== 执行备份 ==============================================================
Write-Host "[backup] 开始备份 $PG_DATABASE → $filePath" -ForegroundColor Cyan
Write-Host "[backup] 主机: $PG_HOST`:$PG_PORT  用户: $PG_USER" -ForegroundColor Cyan

$startTime = Get-Date

try {
    if ($Format -eq "plain") {
        & pg_dump @dumpArgs | & gzip > $filePath
        if ($LASTEXITCODE -ne 0) {
            throw "pg_dump 退出码: $LASTEXITCODE"
        }
    } else {
        & pg_dump @dumpArgs
        if ($LASTEXITCODE -ne 0) {
            throw "pg_dump 退出码: $LASTEXITCODE"
        }
    }

    $elapsed = (Get-Date) - $startTime
    $fileSize = (Get-Item -LiteralPath $filePath).Length
    $sizeStr = if ($fileSize -gt 1MB) {
        "{0:N1} MB" -f ($fileSize / 1MB)
    } else {
        "{0:N1} KB" -f ($fileSize / 1KB)
    }

    Write-Host "[backup] 完成！耗时: $($elapsed.TotalSeconds.ToString('0.0'))s  大小: $sizeStr" -ForegroundColor Green
    Write-Host "[backup] 输出: $filePath" -ForegroundColor Green

    # ===== 恢复参考命令 ======================================================
    Write-Host ""
    Write-Host "恢复命令参考（务必确认目标库后执行）：" -ForegroundColor Cyan
    switch ($Format) {
        "plain" {
            Write-Host "  # 恢复 plain 格式（需手动解压）：" -ForegroundColor Cyan
            Write-Host "  gzip -d -c `"$filePath`" | psql -h `$env:PGHOST -p `$env:PGPORT -U `$env:PGUSER -d `$env:PGDATABASE" -ForegroundColor Cyan
        }
        "custom" {
            Write-Host "  # 恢复 custom 格式：" -ForegroundColor Cyan
            Write-Host "  pg_restore -h `$env:PGHOST -p `$env:PGPORT -U `$env:PGUSER -d `$env:PGDATABASE -c --if-exists `"$filePath`"" -ForegroundColor Cyan
        }
        "directory" {
            Write-Host "  # 恢复 directory 格式（并行恢复）：" -ForegroundColor Cyan
            Write-Host "  pg_restore -h `$env:PGHOST -p `$env:PGPORT -U `$env:PGUSER -d `$env:PGDATABASE -j 4 -c --if-exists `"$filePath`"" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "[backup] 失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # 清理环境变量中的密码（可选）
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
