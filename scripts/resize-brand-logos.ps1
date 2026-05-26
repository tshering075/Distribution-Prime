# Resize master logo PNG to HD public brand assets (downscale only = sharp).
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceImage
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourceImage)) {
  throw "Source not found: $SourceImage"
}

$publicDir = Join-Path $PSScriptRoot "..\public"
$resolved = Resolve-Path $SourceImage
$src = [System.Drawing.Image]::FromFile($resolved)
$masterMax = [Math]::Max($src.Width, $src.Height)

# HD outputs — UI uses 512+ so retina displays stay crisp (no upscaling blur).
$targets = @(
  @{ Path = "oauth-app-logo.png"; Size = 512 },
  @{ Path = "tashi-beverages-mark.png"; Size = 512 },
  @{ Path = "coke-sales-icon-192.png"; Size = 512 },
  @{ Path = "coke-sales-icon-512.png"; Size = 512 },
  @{ Path = "coke-sales-icon-1024.png"; Size = 1024 }
)

function Save-Resized($image, $outFile, $size) {
  $outSize = [Math]::Min($size, $masterMax)
  $bmp = New-Object System.Drawing.Bitmap $outSize, $outSize
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  $g.DrawImage($image, 0, 0, $outSize, $outSize)
  $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Wrote $outFile ($outSize x $outSize)"
}

foreach ($t in $targets) {
  $out = Join-Path $publicDir $t.Path
  Save-Resized $src $out $t.Size
}

$src.Dispose()
Write-Host "Done. Master was ${masterMax}px. Assets are downscaled for HD, never upscaled."
