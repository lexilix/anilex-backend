Add-Type -AssemblyName System.Drawing

$imgPath = 'C:\Users\Admin\.gemini\antigravity\brain\5f10144b-21c4-44b3-b517-d2fda6a5af33\.user_uploaded\media_1790258137032.png'
$outPath = 'd:\Ai_project\anime_Auti\client\public\mugen_gacha_poster.jpg'
$img = [System.Drawing.Bitmap]::FromFile($imgPath)

# Accurate crop: x: 29, y: 102, width: 198, height: 278
$cropRect = New-Object System.Drawing.Rectangle(29, 102, 198, 278)
$target = New-Object System.Drawing.Bitmap(198, 278)
$g = [System.Drawing.Graphics]::FromImage($target)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, 198, 278)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

$target.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$target.Dispose()
$img.Dispose()

Write-Host "Updated cropped poster: $outPath"
