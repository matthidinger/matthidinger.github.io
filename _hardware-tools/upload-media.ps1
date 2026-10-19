<#
.SYNOPSIS
  Publishes the Hardware photos to https://matthidingerpreviews.z5.web.core.windows.net/media/hardware/.

.DESCRIPTION
  Uploads every .jpg in the media folder (default .artifacts/hardware-media) to media/hardware/ in the $web
  container of the matthidingerpreviews storage account, signed in as you (az login). Existing blobs with the same
  name are replaced; nothing is ever deleted. It first runs check-photos.mjs --check and stops if any photo still
  carries metadata, is missing, or photos.yml is out of date.

  Uploaded photos are public. Published copies are cached for up to a day, so give a replaced photo a new name if
  it must change immediately.

.EXAMPLE
  ./upload-media.ps1 -DryRun     # list what would be uploaded
  ./upload-media.ps1
#>
[CmdletBinding()]
param(
  [string]$Source = "$PSScriptRoot/../.artifacts/hardware-media",
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

node (Join-Path $PSScriptRoot 'check-photos.mjs') $Source --check
if ($LASTEXITCODE -ne 0) { throw 'check-photos.mjs found problems; nothing was uploaded.' }

$azArgs = @(
  'storage', 'blob', 'upload-batch',
  '--auth-mode', 'login',
  '--account-name', 'matthidingerpreviews',
  '--destination', '$web',
  '--destination-path', 'media/hardware',
  '--source', (Resolve-Path $Source).Path,
  '--pattern', '*.jpg',
  '--content-type', 'image/jpeg',
  '--content-cache-control', 'public, max-age=86400',
  '--overwrite', 'true',
  '--only-show-errors'
)
if ($DryRun) { $azArgs += '--dryrun' }
az @azArgs
if ($LASTEXITCODE -ne 0) { throw "az storage blob upload-batch failed ($LASTEXITCODE)." }
