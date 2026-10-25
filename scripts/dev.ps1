# 本地开发启动器：自动读 Windows 系统代理，让 Node 的 fetch 也走代理
#
# 原理：Node 24 的 fetch 不读 Windows 系统代理；只有 NODE_USE_ENV_PROXY=1 + HTTPS_PROXY
#       才会使用（只设 HTTPS_PROXY 无效，实测仍直连 → 被污染 DNS 解析到错误 IP 并超时）。
#       生产服务器能直连 bgm.tv，不受影响，只有本地 dev 需要。
$proxy = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue).ProxyServer
if ($proxy) {
  if ($proxy -notmatch '^https?://') { $proxy = "http://$proxy" }
  $env:HTTPS_PROXY = $proxy
  $env:HTTP_PROXY = $proxy
  $env:NODE_USE_ENV_PROXY = "1"
  Write-Host "[dev] 已启用系统代理: $proxy"
} else {
  Write-Host "[dev] 未检测到系统代理，直连启动"
}
pnpm dev