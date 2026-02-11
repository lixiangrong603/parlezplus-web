#!/bin/bash
# 验证本地开发环境配置

echo "🔍 ParlezPlus 开发环境验证"
echo "=============================="
echo ""

# 1. 检查 Node.js 和 npm
echo "1️⃣  检查 Node.js..."
if command -v node &> /dev/null; then
    echo "   ✅ Node.js $(node --version)"
else
    echo "   ❌ 未安装 Node.js"
    exit 1
fi

if command -v npm &> /dev/null; then
    echo "   ✅ npm $(npm --version)"
else
    echo "   ❌ 未安装 npm"
    exit 1
fi

# 2. 检查项目依赖
echo ""
echo "2️⃣  检查项目依赖..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules 已安装"
else
    echo "   ⚠️  未找到 node_modules，运行 npm install"
    npm install
fi

# 3. 检查 Wrangler CLI
echo ""
echo "3️⃣  检查 Wrangler CLI..."
if npx wrangler --version &> /dev/null; then
    WRANGLER_VERSION=$(npx wrangler --version 2>&1 | grep -oP '\d+\.\d+\.\d+' | head -1)
    echo "   ✅ Wrangler v$WRANGLER_VERSION"
else
    echo "   ❌ Wrangler 不可用"
    exit 1
fi

# 4. 检查 Cloudflare 登录
echo ""
echo "4️⃣  检查 Cloudflare 登录..."
if npx wrangler whoami &> /dev/null; then
    ACCOUNT=$(npx wrangler whoami 2>&1 | grep -oP '(?<=Account: ).*' || echo "已登录")
    echo "   ✅ 已登录 Cloudflare"
else
    echo "   ⚠️  未登录 Cloudflare（运行: npm run login）"
fi

# 5. 检查 D1 数据库
echo ""
echo "5️⃣  检查 D1 数据库..."
if npx wrangler d1 list 2>&1 | grep -q "parlezplus_db"; then
    echo "   ✅ D1 数据库 parlezplus_db 已创建"
else
    echo "   ⚠️  D1 数据库未找到（运行: npm run db:create）"
fi

# 6. 检查环境变量文件
echo ""
echo "6️⃣  检查环境变量..."
if [ -f ".dev.vars" ]; then
    echo "   ✅ .dev.vars 文件存在"
    if grep -q "JWT_SECRET" .dev.vars; then
        echo "   ✅ JWT_SECRET 已配置"
    else
        echo "   ⚠️  JWT_SECRET 未配置"
    fi
else
    echo "   ⚠️  .dev.vars 文件不存在"
fi

# 7. 检查构建产物
echo ""
echo "7️⃣  检查构建产物..."
if [ -d "dist" ]; then
    echo "   ✅ dist 目录存在"
    DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
    echo "   📦 构建大小: $DIST_SIZE"
else
    echo "   ⚠️  未找到 dist 目录（运行: npm run build）"
fi

# 8. 检查数据库文件
echo ""
echo "8️⃣  检查本地数据库..."
if [ -d ".wrangler/state" ]; then
    echo "   ✅ Wrangler 本地存储已初始化"
else
    echo "   ⚠️  本地数据库未初始化"
fi

# 总结
echo ""
echo "=============================="
echo "✨ 验证完成！"
echo ""
echo "📋 快速启动命令："
echo "   Vite Dev (快):      npm run dev"
echo "   Wrangler Dev (完整): npm run dev:wrangler"
echo "   自动启动:           npm run dev:quick"
echo ""
