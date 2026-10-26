# =============================================================
# tools\e2e_manager.ps1  --  live smoke test for the 4 manager functions
#
# Usage (PowerShell 5.1, ASCII-only on purpose: ANSI .ps1 + Chinese = parse errors):
#   powershell -ExecutionPolicy Bypass -File tools\e2e_manager.ps1 `
#       -Username mgr01 -Password 'your-password' -Func review -Action list
#
#   # approve a pending applicant by id (get the id from -Action list)
#   ... -Func review -Action approve -Payload '{"id":"...","staff_name":"XXX","role":"employee"}'
#
#   # create an invite code
#   ... -Func invites -Action create -Payload '{"max_uses":5,"note":"Oct batch"}'
#
# Login is done first; the returned access_token is what the manager function
# receives in body.token (the browser sends it the same way).
# =============================================================

param(
  [Parameter(Mandatory = $true)][string]$Username,
  [Parameter(Mandatory = $true)][string]$Password,
  [Parameter(Mandatory = $true)][ValidateSet('review', 'invites', 'offboard', 'devices')][string]$Func,
  [string]$Action = 'list',
  [string]$Payload = '{}',
  [string]$Base = 'https://xoqvrkqxtipkavmfaxyy.supabase.co',
  [string]$DeviceId = 'e2e0123456789abcdef0123456789ab'
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Post-Json([string]$Url, $Body) {
  $json = $Body | ConvertTo-Json -Depth 10 -Compress
  try {
    return Invoke-RestMethod -Uri $Url -Method Post -ContentType 'application/json;charset=UTF-8' -Body $json
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      Write-Host "HTTP $([int]$resp.StatusCode) $($resp.StatusDescription)" -ForegroundColor Red
      Write-Host $sr.ReadToEnd() -ForegroundColor Red
    }
    throw
  }
}

Write-Host "== 1. login as $Username ==" -ForegroundColor Cyan
$login = Post-Json "$Base/functions/v1/login" @{
  username  = $Username
  password  = $Password
  device_id = $DeviceId
  ua        = 'e2e_manager.ps1'
}
if (-not $login.ok) {
  Write-Host "login failed: $($login.reason) / $($login.message)" -ForegroundColor Red
  exit 1
}
$token = $login.session.access_token
Write-Host "   ok  role=$($login.profile.role)  token=$($token.Length) chars" -ForegroundColor Green

Write-Host "== 2. $Func / $Action ==" -ForegroundColor Cyan
$body = @{}
$extra = $Payload | ConvertFrom-Json
if ($extra -and $extra.PSObject) {
  foreach ($p in $extra.PSObject.Properties) { $body[$p.Name] = $p.Value }
}
$body['token'] = $token
$body['action'] = $Action

$r = Post-Json "$Base/functions/v1/$Func" $body
$r | ConvertTo-Json -Depth 8

if ($r.ok -eq $true) {
  Write-Host "`nRESULT: OK" -ForegroundColor Green
  exit 0
}
Write-Host "`nRESULT: FAILED ($($r.code) $($r.error))" -ForegroundColor Red
exit 1
