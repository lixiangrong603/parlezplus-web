# 验证本地开发环境配置 - PowerShell 版本

Write-Host "🔍 ParlezPlus 开发环境验证" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 1. 检查 Node.js 和 npm
Write-Host "1️⃣  检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ 未安装 Node.js" -ForegroundColor Red
    $allGood = $false
}

try {
    $npmVersion = npm --version
    Write-Host "   ✅ npm $npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ 未安装 npm" -ForegroundColor Red
    $allGood = $false
}

# 2. 检查项目依赖
Write-Host ""
Write-Host "2️⃣  检查项目依赖..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules 已安装" -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  未找到 node_modules" -ForegroundColor Yellow
}

# 3. 检查 Wrangler CLI
Write-Host ""
Write-Host "3️⃣  检查 Wrangler CLI..." -ForegroundColor Yellow
try {
    $wranglerVersion = npx wrangler --version 2>&1 | Out-String
    if ($wranglerVersion -match '\d+\.\d+\.\d+') {
        Write-Host "   ✅ Wrangler 已安装" -ForegroundColor Green
    }
}
catch {
    Write-Host "   ❌ Wrangler 不可用" -ForegroundColor Red
    $allGood = $false
}

# 4. 检查环境变量文件
Write-Host ""
Write-Host "4️⃣  检查环境变量..." -ForegroundColor Yellow
if (Test-Path ".dev.vars") {
    Write-Host "   ✅ .dev.vars 文件存在" -ForegroundColor Green
    $devVars = Get-Content .dev.vars -Raw
    if ($devVars -match "JWT_SECRET") {
        Write-Host "   ✅ JWT_SECRET 已配置" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️  JWT_SECRET 未配置" -ForegroundColor Yellow
    }
}
else {
    Write-Host "   ⚠️  .dev.vars 文件不存在" -ForegroundColor Yellow
}

# 5. 检查构建产物
Write-Host ""
Write-Host "5️⃣  检查构建产物..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Write-Host "   ✅ dist 目录存在" -ForegroundColor Green
    $distSize = (Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "   📦 构建大小: $($distSize.ToString('F2')) MB" -ForegroundColor Cyan
}
else {
    Write-Host "   ⚠️  未找到 dist 目录（运行: npm run build）" -ForegroundColor Yellow
}

# 6. 检查数据库文件
Write-Host ""
Write-Host "6️⃣  检查本地数据库..." -ForegroundColor Yellow
if (Test-Path ".wrangler/state") {
    Write-Host "   ✅ Wrangler 本地存储已初始化" -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  本地数据库未初始化" -ForegroundColor Yellow
}

# 总结
Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "✨ 验证完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 快速启动命令：" -ForegroundColor Cyan
Write-Host "   Vite Dev (快):       npm run dev" -ForegroundColor White
Write-Host "   Wrangler Dev (完整): npm run dev:wrangler" -ForegroundColor White
Write-Host "   自动启动:            npm run dev:quick" -ForegroundColor White
Write-Host ""

if ($allGood) {
    Write-Host "✅ 所有检查通过，可以开始开发！" -ForegroundColor Green
}
else {
    Write-Host "⚠️  部分检查未通过，请按照提示修复" -ForegroundColor Yellow
}
