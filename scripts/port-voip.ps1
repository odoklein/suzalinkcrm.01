param(
  [string]$SourceRoot = "C:\Users\PC\Desktop\captainprospect-crm-main",
  [string]$DestinationRoot = (Get-Location).Path,
  [switch]$IncludeOptional,
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-ParentDirectory {
  param([string]$Path)
  $parent = Split-Path -Path $Path -Parent
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
}

function Copy-Entry {
  param(
    [string]$RelativePath,
    [bool]$IsDirectory
  )

  $src = Join-Path $SourceRoot $RelativePath
  $dst = Join-Path $DestinationRoot $RelativePath

  if (-not (Test-Path -LiteralPath $src)) {
    $script:missing += $RelativePath
    Write-Host "MISSING: $RelativePath" -ForegroundColor Yellow
    return
  }

  if ($IsDirectory) {
    if ($Apply) {
      if (-not (Test-Path -LiteralPath $dst)) {
        New-Item -ItemType Directory -Path $dst -Force | Out-Null
      }
      Copy-Item -LiteralPath (Join-Path $src "*") -Destination $dst -Recurse -Force
      Write-Host "COPIED DIR: $RelativePath" -ForegroundColor Green
    } else {
      Write-Host "DRY-RUN DIR: $RelativePath" -ForegroundColor DarkGray
    }
    return
  }

  Ensure-ParentDirectory -Path $dst
  if ($Apply) {
    Copy-Item -LiteralPath $src -Destination $dst -Force
    Write-Host "COPIED FILE: $RelativePath" -ForegroundColor Green
  } else {
    Write-Host "DRY-RUN FILE: $RelativePath" -ForegroundColor DarkGray
  }
}

if (-not (Test-Path -LiteralPath $SourceRoot)) {
  throw "Source root not found: $SourceRoot"
}
if (-not (Test-Path -LiteralPath $DestinationRoot)) {
  throw "Destination root not found: $DestinationRoot"
}

$requiredEntries = @(
  @{ path = "lib\voip"; isDir = $true },
  @{ path = "app\api\voip\initiate\route.ts"; isDir = $false },
  @{ path = "app\api\integrations\voip\webhook\[provider]\route.ts"; isDir = $false },
  @{ path = "app\api\webhooks\withallo\route.ts"; isDir = $false },
  @{ path = "app\api\voip\process\route.ts"; isDir = $false },
  @{ path = "app\api\voip\config\route.ts"; isDir = $false },
  @{ path = "app\api\voip\recording\route.ts"; isDir = $false },
  @{ path = "lib\webhooks\withallo"; isDir = $true },
  @{ path = "lib\comms\events.ts"; isDir = $false },
  @{ path = "app\api\comms\events\route.ts"; isDir = $false },
  @{ path = "hooks\useVoipCall.ts"; isDir = $false },
  @{ path = "hooks\useVoipListener.ts"; isDir = $false },
  @{ path = "components\voip\VoipCallValidationModal.tsx"; isDir = $false },
  @{ path = "app\api\actions\[id]\route.ts"; isDir = $false },
  @{ path = "prisma\migrations\20260222160000_unified_voip_layer\migration.sql"; isDir = $false },
  @{ path = "prisma\migrations\20260222170000_add_allo_api_key\migration.sql"; isDir = $false },
  @{ path = "prisma\migrations\20260227120000_add_call_record\migration.sql"; isDir = $false }
)

$optionalEntries = @(
  @{ path = "app\api\voip\allo\sync-call\route.ts"; isDir = $false },
  @{ path = "lib\voip\providers\allo\sync-call.ts"; isDir = $false },
  @{ path = "app\api\voip\test-qstash\route.ts"; isDir = $false },
  @{ path = "app\sdr\settings\voip\page.tsx"; isDir = $false },
  @{ path = "components\drawers\UnifiedActionDrawer.tsx"; isDir = $false },
  @{ path = "app\api\cron\withallo-sync\route.ts"; isDir = $false }
)

$script:missing = @()
$toCopy = @($requiredEntries)
if ($IncludeOptional) {
  $toCopy += $optionalEntries
}

Write-Step "Source: $SourceRoot"
Write-Step "Destination: $DestinationRoot"
Write-Step ("Mode: " + ($(if ($Apply) { "APPLY (will copy)" } else { "DRY-RUN (no writes)" })))
Write-Step ("Optional set: " + ($(if ($IncludeOptional) { "included" } else { "skipped" })))

foreach ($entry in $toCopy) {
  Copy-Entry -RelativePath $entry.path -IsDirectory $entry.isDir
}

Write-Host ""
if ($missing.Count -gt 0) {
  Write-Host "Completed with missing paths ($($missing.Count)):" -ForegroundColor Yellow
  foreach ($m in $missing) {
    Write-Host " - $m" -ForegroundColor Yellow
  }
} else {
  Write-Host "Completed with no missing paths." -ForegroundColor Green
}

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry-run only. Re-run with -Apply to perform copies." -ForegroundColor Cyan
}
