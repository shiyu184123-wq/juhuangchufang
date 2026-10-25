# 一键验收脚本
# 用法：pwsh -File .\scripts\check.ps1
# AI 每轮结束前必须跑这个，并把输出贴出来

$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Test-Path 'package.json')) {
  Write-Host '[跳过] 项目尚未初始化，先执行 tasks/P0-01-init.md' -ForegroundColor Yellow
  exit 0
}

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
  Write-Host '[失败] 未找到 pnpm，先执行 npm i -g pnpm' -ForegroundColor Red
  exit 1
}

$failed = @()

foreach ($step in @('build', 'lint')) {
  Write-Host ''
  Write-Host "==> pnpm $step" -ForegroundColor Cyan
  pnpm $step
  if ($LASTEXITCODE -ne 0) { $failed += $step }
}

# 单元测试装好后才跑
$pkg = Get-Content 'package.json' -Raw | ConvertFrom-Json
if ($pkg.scripts.PSObject.Properties.Name -contains 'test') {
  Write-Host ''
  Write-Host '==> pnpm test' -ForegroundColor Cyan
  pnpm test
  if ($LASTEXITCODE -ne 0) { $failed += 'test' }
}

Write-Host ''
if ($failed.Count -gt 0) {
  Write-Host ("[失败] " + ($failed -join ', ')) -ForegroundColor Red
  exit 1
}

Write-Host '[通过] 全部验收命令成功' -ForegroundColor Green
Write-Host '记得：更新 PROGRESS.md 并 git commit' -ForegroundColor DarkGray