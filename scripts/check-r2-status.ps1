# R2 文件状态检查脚本

Write-Host "`n=== R2 清理状态检查 ===`n" -ForegroundColor Cyan

# 1. 检查本地 R2 文件数量
$r2Path = ".wrangler\state\v3\r2\parlezplus-media\blobs"
if (Test-Path $r2Path) {
    $fileCount = (Get-ChildItem $r2Path -File).Count
    Write-Host "本地 R2 文件数量: $fileCount" -ForegroundColor Yellow
    
    if ($fileCount -gt 0) {
        Write-Host "`n前 5 个文件:" -ForegroundColor Gray
        Get-ChildItem $r2Path -File | Select-Object -First 5 | ForEach-Object {
            $sizeMB = [math]::Round($_.Length / 1MB, 2)
            Write-Host "  - $($_.Name) ($sizeMB MB)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "本地 R2 路径不存在: $r2Path" -ForegroundColor Red
}

Write-Host "`n" -ForegroundColor Cyan
Write-Host "=== 数据库状态检查 ===" -ForegroundColor Cyan
Write-Host "`n正在查询数据库...`n" -ForegroundColor Gray

# 2. 检查数据库中的资源
$dbQueries = @(
    @{
        Name = "总资源数"
        Query = "SELECT COUNT(*) as count FROM resources"
    },
    @{
        Name = "软删除资源数"
        Query = "SELECT COUNT(*) as count FROM resources WHERE is_deleted = 1"
    },
    @{
        Name = "活动资源数" 
        Query = "SELECT COUNT(*) as count FROM resources WHERE is_deleted = 0"
    }
)

foreach ($q in $dbQueries) {
    Write-Host "$($q.Name):" -NoNewline
    $result = npx wrangler d1 execute parlezplus_db --local --command="$($q.Query)" 2>$null
    if ($result -match '\d+') {
        $count = [regex]::Match($result, '\d+').Value
        Write-Host " $count" -ForegroundColor Green
    } else {
        Write-Host " 查询失败" -ForegroundColor Red
    }
}

Write-Host "`n=== 结论 ===" -ForegroundColor Cyan

if ($fileCount -gt 0) {
    Write-Host @"

⚠️  发现 $fileCount 个 R2 文件存在于本地存储中

这是正常的，因为：
1. 本地开发环境使用 Wrangler 模拟 R2
2. 即使数据库记录被删除，本地文件系统不会自动清理
3. 这不影响删除功能的正确性

验证删除功能是否工作：
1. 永久删除一个资源后，查看控制台日志
2. 应该看到 "Deleted R2 file: xxx" 的消息
3. R2.delete() API 调用成功即表示删除功能正常

如需清理本地 R2 存储：
  Remove-Item -Path "$r2Path\*" -Force

注意：生产环境中，R2.delete() 会立即生效
"@ -ForegroundColor Yellow
} else {
    Write-Host "`n✅ 本地 R2 存储为空" -ForegroundColor Green
}

Write-Host ""
