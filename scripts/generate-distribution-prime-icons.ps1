# Generate Distribution Prime PNG icons from master 1024 asset (or SVG fallback script).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot "..\public"
$master = Join-Path $publicDir "distribution-prime-icon-1024.png"

if (-not (Test-Path $master)) {
  throw "Missing master logo at public/distribution-prime-icon-1024.png"
}

$src = [System.Drawing.Image]::FromFile((Resolve-Path $master))
$masterMax = [Math]::Max($src.Width, $src.Height)

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
  Write-Host "Wrote $outFile (${outSize}px)"
}

@(
  @{ Path = "distribution-prime-icon-192.png"; Size = 192 },
  @{ Path = "distribution-prime-icon-512.png"; Size = 512 },
  @{ Path = "distribution-prime-icon-1024.png"; Size = 1024 }
) | ForEach-Object {
  Save-Resized $src (Join-Path $publicDir $_.Path) $_.Size
}

$src.Dispose()
Write-Host "Distribution Prime icons ready."
