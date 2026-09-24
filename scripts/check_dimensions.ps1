Add-Type -AssemblyName System.Drawing
$imgPath = 'C:\Users\Admin\.gemini\antigravity\brain\5f10144b-21c4-44b3-b517-d2fda6a5af33\.user_uploaded\media_1790258137032.png'
$img = [System.Drawing.Image]::FromFile($imgPath)
Write-Host "Image size: $($img.Width) x $($img.Height)"
$img.Dispose()
