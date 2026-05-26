# Regenerate all brand PNGs from the master logo file.
# Example:
#   .\scripts\resize-brand-logos.ps1 -SourceImage "C:\path\to\your-logo.png"

param([string]$SourceImage = "")

$script = Join-Path $PSScriptRoot "resize-brand-logos.ps1"
if (-not $SourceImage) {
  $candidates = @(
    (Join-Path $PSScriptRoot "..\assets\brand-logo-master.png"),
    (Join-Path $PSScriptRoot "..\public\brand-logo-master.png")
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $SourceImage = $c; break }
  }
}
if (-not $SourceImage) {
  Write-Host "Pass -SourceImage path to your 1024x1024 (or square) logo PNG."
  exit 1
}
& $script -SourceImage $SourceImage
