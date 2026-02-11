#!/bin/bash
# 快速启动本地开发环境脚本（连接 D1 + R2）

set -e

echo "🚀 ParlezPlus 本地开发环境启动脚本"
echo "===================================="
echo ""

# 检查是否已登录 Cloudflare
if ! npx wrangler whoami &>/dev/null; then
    echo "❌ 尚未登录 Cloudflare，请先运行："
    echo "   npm run login"
    exit 1
fi

echo "✅ Cloudflare 已登录"

# 检查 .dev.vars 是否存在
if [ ! -f .dev.vars ]; then
    echo "⚠️  未找到 .dev.vars 文件，创建默认配置..."
    cat > .dev.vars << 'EOF'
# 本地开发环境变量
JWT_SECRET=dev-secret-$(openssl rand -hex 16)
# GEMINI_MASTER_KEY=
# AZURE_MASTER_KEY=
EOF
    echo "✅ 已创建 .dev.vars（请根据需要补充 API 密钥）"
fi

# 检查是否需要初始化数据库
echo ""
echo "📊 检查数据库状态..."
if ! npx wrangler d1 execute parlezplus_db --local --command="SELECT 1 FROM users LIMIT 1" &>/dev/null; then
    echo "⚠️  数据库未初始化，正在应用 Schema..."
    npx wrangler d1 execute parlezplus_db --local --file=database/schema.sql
    echo "✅ 数据库 Schema 已应用"
    
    if [ -f database/seed.sql ]; then
        echo "🌱 填充初始数据..."
        npx wrangler d1 execute parlezplus_db --local --file=database/seed.sql
        echo "✅ 初始数据已填充"
    fi
else
    echo "✅ 数据库已就绪"
fi

# 检查是否有 dist 目录
if [ ! -d dist ]; then
    echo ""
    echo "📦 首次运行，正在构建前端..."
    npm run build
fi

echo ""
echo "✨ 启动开发服务器..."
echo "   访问: http://localhost:8788"
echo ""
echo "💡 提示："
echo "   - 按 Ctrl+C 停止服务器"
echo "   - 修改代码后需重新构建"
echo "   - 建议使用两个终端："
echo "     终端1: npm run build:watch"
echo "     终端2: npm run pages:dev"
echo ""

# 启动 Wrangler Pages Dev
npx wrangler pages dev dist --live-reload
