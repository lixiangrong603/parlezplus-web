# 快速启动本地开发环境脚本（连接 D1 + R2）- Windows 版本

Write-Host "🚀 ParlezPlus 本地开发环境启动脚本" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否已登录 Cloudflare
try {
    npx wrangler whoami 2>&1 | Out-Null
    Write-Host "✅ Cloudflare 已登录" -ForegroundColor Green
} catch {
    Write-Host "❌ 尚未登录 Cloudflare，请先运行：" -ForegroundColor Red
    Write-Host "   npm run login" -ForegroundColor Yellow
    exit 1
}

# 检查 .dev.vars 是否存在
if (-not (Test-Path .dev.vars)) {
    Write-Host "⚠️  未找到 .dev.vars 文件，创建默认配置..." -ForegroundColor Yellow
    $randomBytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16)
    $randomHex = [System.BitConverter]::ToString($randomBytes).Replace('-', '').ToLower()
    @"
# 本地开发环境变量
JWT_SECRET=dev-secret-$randomHex
# GEMINI_MASTER_KEY=
# AZURE_MASTER_KEY=
"@ | Out-File -FilePath .dev.vars -Encoding UTF8
    Write-Host "✅ 已创建 .dev.vars（请根据需要补充 API 密钥）" -ForegroundColor Green
}

# 检查是否需要初始化数据库
Write-Host ""
Write-Host "📊 检查数据库状态..." -ForegroundColor Cyan
try {
    npx wrangler d1 execute parlezplus_db --local --command="SELECT 1 FROM users LIMIT 1" 2>&1 | Out-Null
    Write-Host "✅ 数据库已就绪" -ForegroundColor Green
} catch {
    Write-Host "⚠️  数据库未初始化，正在应用 Schema..." -ForegroundColor Yellow
    npx wrangler d1 execute parlezplus_db --local --file=database/schema.sql
    Write-Host "✅ 数据库 Schema 已应用" -ForegroundColor Green
    
    if (Test-Path database/seed.sql) {
        Write-Host "🌱 填充初始数据..." -ForegroundColor Cyan
        npx wrangler d1 execute parlezplus_db --local --file=database/seed.sql
        Write-Host "✅ 初始数据已填充" -ForegroundColor Green
    }
}

# 检查是否有 dist 目录
if (-not (Test-Path dist)) {
    Write-Host ""
    Write-Host "📦 首次运行，正在构建前端..." -ForegroundColor Cyan
    npm run build
}

Write-Host ""
Write-Host "✨ 启动开发服务器..." -ForegroundColor Green
Write-Host "   访问: http://localhost:8788" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 提示：" -ForegroundColor Yellow
Write-Host "   - 按 Ctrl+C 停止服务器"
Write-Host "   - 修改代码后需重新构建"
Write-Host "   - 建议使用两个终端："
Write-Host "     终端1: npm run build:watch"
Write-Host "     终端2: npm run pages:dev"
Write-Host ""

# 启动 Wrangler Pages Dev
# 日志级别：none=无日志, error=仅错误, warn=警告, log=正常(默认), debug=调试
# 如需查看所有请求日志，可以去掉 --log-level error
npx wrangler pages dev dist --live-reload --log-level error
