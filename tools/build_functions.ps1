# =============================================================
# tools/build_functions.ps1
# Bundle every Edge Function into ONE paste-ready file.
#
# Why: Supabase Dashboard "Via Editor" deploy does NOT support ../_shared
# imports, and CLI deploy needs Docker. So we merge locally with esbuild.
#
# Usage: powershell -ExecutionPolicy Bypass -File tools\build_functions.ps1
# Output: tools\_build\f\<name>.ts  (gitignored)
# NOTE: keep this file ASCII-only. PowerShell 5.1 reads .ps1 as ANSI
#       without BOM, so non-ASCII text breaks the parser.
# =============================================================

$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$outDir = 'tools\_build\f'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$funcs = Get-ChildItem 'supabase\functions' -Directory |
  Where-Object { $_.Name -notlike '_*' } |
  Where-Object { Test-Path (Join-Path $_.FullName 'index.ts') }

Write-Host "Found $($funcs.Count) function(s): $($funcs.Name -join ', ')"
Write-Host ""

$bad = 0
foreach ($f in $funcs) {
  $src = "supabase\functions\$($f.Name)\index.ts"
  $dst = "$outDir\$($f.Name).ts"

  npx --yes esbuild@0.24.0 $src --bundle --format=esm --platform=neutral --target=es2022 --charset=utf8 --outfile=$dst --log-level=warning 2>&1 | Out-String | ForEach-Object { if ($_ -ne '') { Write-Host $_ } }

  $txt = Get-Content $dst -Raw
  $imports = ([regex]::Matches($txt, '(?m)^\s*import\s')).Count
  $size = (Get-Item $dst).Length
  $lines = ($txt -split "`n").Count
  Write-Host ("  {0,-10} {1,7} bytes  {2,4} lines  leftover import: {3}" -f $f.Name, $size, $lines, $imports)
  if ($imports -ne 0) {
    $bad++
    Write-Host "  WARN: $($f.Name) still has import statements, cannot paste-deploy" -ForegroundColor Red
  }
}

Write-Host ""
if ($bad -gt 0) {
  Write-Host "FAILED: $bad function(s) not paste-ready"
  exit 1
}
Write-Host "OK. Paste-ready files are in: $outDir"
