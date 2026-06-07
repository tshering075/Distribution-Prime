# Generate simple DMS PNG icons for PWA / favicon.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot "..\public"
$bg = [System.Drawing.Color]::FromArgb(255, 13, 71, 161)

function New-DmsIcon {
  param([int]$Size, [string]$OutPath)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear($bg)

  $penWidth = [Math]::Max(2, [int]($Size / 40))
  $boxPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $penWidth
  $boxPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $boxPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $boxPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $bx = [int]($Size * 0.32)
  $by = [int]($Size * 0.28)
  $bw = [int]($Size * 0.36)
  $bh = [int]($Size * 0.24)
  $top = $by + [int]($bh * 0.35)

  $g.DrawRectangle($boxPen, $bx, $top, $bw, $bh)
  $g.DrawLine($boxPen, $bx + [int]($bw * 0.2), $top, $bx + [int]($bw * 0.2), $by)
  $g.DrawLine($boxPen, $bx + [int]($bw * 0.8), $top, $bx + [int]($bw * 0.8), $by)

  $fontSize = [Math]::Max(18, [int]($Size * 0.17))
  $font = [System.Drawing.Font]::new("Arial", [single]$fontSize, [System.Drawing.FontStyle]::Bold)
  $brush = [System.Drawing.Brushes]::White
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString("DMS", $font, $brush, [single]($Size / 2), [single]($Size * 0.78), $sf)

  $font.Dispose()
  $boxPen.Dispose()
  $g.Dispose()
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $OutPath"
}

New-DmsIcon -Size 192 -OutPath (Join-Path $publicDir "dms-icon-192.png")
New-DmsIcon -Size 512 -OutPath (Join-Path $publicDir "dms-icon-512.png")
New-DmsIcon -Size 1024 -OutPath (Join-Path $publicDir "dms-icon-1024.png")

Copy-Item (Join-Path $publicDir "dms-icon-192.png") (Join-Path $publicDir "bevflow-icon-192.png") -Force
Copy-Item (Join-Path $publicDir "dms-icon-512.png") (Join-Path $publicDir "bevflow-icon-512.png") -Force
Copy-Item (Join-Path $publicDir "dms-icon-1024.png") (Join-Path $publicDir "bevflow-icon-1024.png") -Force
Write-Host "Done."
