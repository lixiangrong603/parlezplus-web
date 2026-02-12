# CDN 缓存预热脚本
# 批量请求 R2 bucket 中的所有媒体文件，让 Cloudflare CDN 缓存

Write-Host "`n=== Cloudflare CDN 缓存预热工具 ===`n" -ForegroundColor Cyan

$MEDIA_BASE_URL = "https://media.fluide.top"

# 已知的媒体文件列表（从迁移脚本的输出获取）
$mediaFiles = @(
    "avatars/user-1770694205530-x08pvjc/1770868687761_sfi8.jpg",
    "avatars/user-1770745599792-8tos33r/1770866479487_u0zid.jpg",
    "covers/user-1770694205530-x08pvjc/1770794107948_3u8m2.jpg",
    "videos/user-1770694205530-x08pvjc/1770794098441_dghx3c.mp4"
)

Write-Host "找到 $($mediaFiles.Count) 个媒体文件`n" -ForegroundColor Yellow

$successCount = 0
$failCount = 0
$cachedCount = 0

foreach ($file in $mediaFiles) {
    $url = "$MEDIA_BASE_URL/$file"
    Write-Host "预热: $file" -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -ErrorAction Stop
        
        # 检查 CDN 缓存状态
        $cacheStatus = $response.Headers['CF-Cache-Status']
        $statusCode = $response.StatusCode
        
        if ($statusCode -eq 200) {
            $successCount++
            if ($cacheStatus -eq 'HIT') {
                Write-Host " ✓ [已缓存]" -ForegroundColor Green
                $cachedCount++
            } elseif ($cacheStatus -eq 'MISS' -or $cacheStatus -eq 'EXPIRED') {
                Write-Host " ✓ [已预热]" -ForegroundColor Cyan
            } else {
                Write-Host " ✓ [$cacheStatus]" -ForegroundColor Yellow
            }
        } else {
            Write-Host " ! [HTTP $statusCode]" -ForegroundColor Yellow
        }
    }
    catch {
        $failCount++
        Write-Host " ✗ [失败: $($_.Exception.Message)]" -ForegroundColor Red
    }
    
    # 避免请求过快
    Start-Sleep -Milliseconds 100
}

Write-Host "`n=== 预热完成 ===" -ForegroundColor Cyan
Write-Host "成功: $successCount" -ForegroundColor Green
Write-Host "失败: $failCount" -ForegroundColor Red
Write-Host "已有缓存: $cachedCount" -ForegroundColor Yellow

if ($failCount -eq 0) {
    Write-Host "`n所有文件已预热到 CDN！用户访问将更快。" -ForegroundColor Green
}

Write-Host "`n提示：可以将新上传的文件路径添加到 `$mediaFiles 数组中，定期运行此脚本。`n" -ForegroundColor Gray
