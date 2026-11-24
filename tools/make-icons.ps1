# Draws the app icon (three white budget bars on blue) at the sizes iOS and the manifest need.
Add-Type -AssemblyName System.Drawing
$outDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'icons'
New-Item -ItemType Directory -Force $outDir | Out-Null

function New-RoundedBar($g, $brush, [float]$x, [float]$y, [float]$w, [float]$h) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $h, $h, 90, 180)
    $path.AddArc($x + $w - $h, $y, $h, $h, 270, 180)
    $path.CloseFigure()
    $g.FillPath($brush, $path)
    $path.Dispose()
}

foreach ($size in 180, 192, 512) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#2a78d6'))
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(110, 255, 255, 255))
    $x = $size * 0.24; $full = $size * 0.52; $h = $size * 0.11
    $rows = @(@(0.27, 0.85), @(0.445, 0.55), @(0.62, 0.30))
    foreach ($row in $rows) {
        $y = $size * $row[0]
        New-RoundedBar $g $soft $x $y $full $h
        New-RoundedBar $g $white $x $y ($full * $row[1]) $h
    }
    $g.Dispose()
    $bmp.Save((Join-Path $outDir "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
Get-ChildItem $outDir | Select-Object Name, Length
