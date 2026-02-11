# 检查孤立的 R2 文件
# 此脚本检查数据库中引用的 R2 文件与实际存储的文件

Write-Host "=== 检查数据库中的 R2 引用 ===" -ForegroundColor Cyan

# 获取所有资源的 R2 keys
Write-Host "`n1. 查询数据库中的资源文件..." -ForegroundColor Yellow
npx wrangler d1 execute parlezplus_db --local --command="SELECT COUNT(*) as total_resources FROM resources"

Write-Host "`n2. 查看已删除的资源..." -ForegroundColor Yellow
npx wrangler d1 execute parlezplus_db --local --command="SELECT id, title, video_r2_key, audio_r2_key, is_deleted, deleted_at FROM resources WHERE is_deleted = 1 ORDER BY deleted_at DESC LIMIT 10"

Write-Host "`n3. 查看所有用户头像..." -ForegroundColor Yellow
npx wrangler d1 execute parlezplus_db --local --command="SELECT id, name, avatar_r2_key, is_deleted FROM users WHERE avatar_r2_key IS NOT NULL LIMIT 10"

Write-Host "`n4. 统计本地 R2 文件数量..." -ForegroundColor Yellow
$r2Path = ".wrangler\state\v3\r2\parlezplus-media\blobs"
if (Test-Path $r2Path) {
    $fileCount = (Get-ChildItem -Path $r2Path -File).Count
    Write-Host "本地 R2 文件数量: $fileCount" -ForegroundColor Green
    
    Write-Host "`n最近修改的文件:" -ForegroundColor Yellow
    Get-ChildItem -Path $r2Path -File | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 5 Name, LastWriteTime, @{N='Size(KB)';E={[math]::Round($_.Length/1KB, 2)}} |
        Format-Table -AutoSize
} else {
    Write-Host "本地 R2 路径不存在: $r2Path" -ForegroundColor Red
}

Write-Host "`n=== 验证删除功能的步骤 ===" -ForegroundColor Cyan
Write-Host "1. 找一个软删除的资源记录 (is_deleted=1)" -ForegroundColor White
Write-Host "2. 记录其 video_r2_key 或 audio_r2_key" -ForegroundColor White
Write-Host "3. 通过浏览器访问: http://localhost:8788/api/media/videos/xxx" -ForegroundColor White
Write-Host "   如果文件还存在，应该能访问" -ForegroundColor White
Write-Host "4. 在界面的回收站中执行'永久删除'" -ForegroundColor White
Write-Host "5. 检查后端日志，应该看到 'Deleted R2 file: xxx' 消息" -ForegroundColor White
Write-Host "6. 再次访问该文件URL，应该返回 404" -ForegroundColor White
Write-Host "`n注意: 本地开发环境需要重启 wrangler dev 才能看到文件系统的变化" -ForegroundColor Yellow
