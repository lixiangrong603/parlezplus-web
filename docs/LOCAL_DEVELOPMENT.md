# 本地开发指南 - 连接 D1 和 R2

本项目现已配置为在本地开发时直接连接 Cloudflare D1 数据库和 R2 存储，与线上环境保持一致。

## 前置准备

1. **安装 Wrangler CLI**（如果尚未安装）：
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare 账号**：
   ```bash
   npm run login
   ```

3. **创建本地数据库**（首次运行）：
   ```bash
   # 应用数据库 Schema
   npm run db:migrate
   
   # 填充初始数据（可选）
   npm run db:seed
   ```

## 开发模式

### 方式一：Wrangler Pages Dev（推荐）

使用此模式可以完整模拟 Cloudflare Pages 环境，包括 D1 和 R2：

```bash
npm run dev:wrangler
```

**特点：**
- ✅ 完整的 Cloudflare Workers 环境
- ✅ 真实的 D1 数据库（本地或远程）
- ✅ R2 存储桶访问
- ✅ 环境变量通过 `.dev.vars` 加载
- ⚠️ 每次修改需要重新构建（约 10-30 秒）

**访问地址：** `http://localhost:8788`

### 方式二：Vite Dev Server（快速开发）

适合纯前端开发，不需要后端 API 时使用：

```bash
npm run dev
```

**特点：**
- ✅ 快速热更新（HMR）
- ✅ 即时反馈
- ⚠️ 无法访问 D1/R2
- ⚠️ API 调用会失败（使用 localStorage fallback）

**访问地址：** `http://localhost:3000`

### 方式三：同时运行（最佳开发体验）

在两个终端窗口分别运行：

**终端 1 - 监听构建：**
```bash
npm run build:watch
```

**终端 2 - Wrangler 开发服务器：**
```bash
npm run pages:dev
```

这样可以实现：
- ✅ 文件变化自动重新构建
- ✅ 完整的 Cloudflare 环境
- ✅ 相对快速的更新（构建 + 刷新）

## 环境变量配置

编辑 `.dev.vars` 文件配置本地开发的敏感信息：

```bash
# JWT 密钥
JWT_SECRET=c3kKBtTuWJjqCZNQ8a4vA5nlgGoDHFde

# Gemini API（可选）
GEMINI_MASTER_KEY=your_api_key_here

# Azure Speech API（可选）
AZURE_MASTER_KEY=your_azure_key_here
```

> ⚠️ **注意：** `.dev.vars` 已添加到 `.gitignore`，不会被提交到 Git

## 数据库操作

### 本地数据库

Wrangler 会自动创建和管理本地 D1 实例（存储在 `.wrangler/state/v3/d1/` 目录）。

**查看数据：**
```bash
npx wrangler d1 execute parlezplus_db --local --command="SELECT * FROM users LIMIT 10"
```

**执行 SQL 文件：**
```bash
npm run db:local database/schema.sql
```

### 远程数据库（生产环境）

**迁移远程数据库：**
```bash
npm run db:migrate
```

**查询远程数据：**
```bash
npx wrangler d1 execute parlezplus_db --command="SELECT COUNT(*) FROM users"
```

## 常见问题

### Q: 启动 `dev:wrangler` 时提示找不到 dist 目录？

**A:** 首次运行时需要先构建：
```bash
npm run build
npm run dev:wrangler
```

### Q: API 请求返回 404？

**A:** 确保使用了正确的开发模式：
- Wrangler Pages Dev → 使用 `http://localhost:8788`
- Vite Dev Server → API 会失败，使用 localStorage fallback

### Q: 如何重置本地数据库？

**A:** 删除本地数据库文件后重新初始化：
```bash
# 删除本地数据库
rm -rf .wrangler/state

# 重新应用 Schema
npx wrangler d1 execute parlezplus_db --local --file=database/schema.sql

# 填充初始数据
npx wrangler d1 execute parlezplus_db --local --file=database/seed.sql
```

### Q: R2 存储在本地如何工作？

**A:** Wrangler 会在本地模拟 R2 存储桶：
- 本地文件存储在 `.wrangler/state/v3/r2/` 目录
- 上传的文件不会真正发送到云端（除非使用 `--remote` 标志）
- 本地和远程 R2 数据是隔离的

### Q: 如何使用远程 D1/R2（而不是本地模拟）？

**A:** 在开发命令中添加 `--remote` 标志：
```bash
npx wrangler pages dev dist --remote
```

> ⚠️ **警告：** 这会直接操作生产环境数据，谨慎使用！

## 部署到生产环境

```bash
npm run deploy
```

这会自动执行：
1. 构建前端 (`npm run build`)
2. 部署到 Cloudflare Pages (`wrangler pages deploy`)

## 推荐工作流

1. **日常前端开发** → 使用 `npm run dev`（快速 HMR）
2. **API 开发/测试** → 使用 `npm run dev:wrangler`（完整环境）
3. **构建优化测试** → 使用 `npm run preview`（生产构建预览）
4. **部署前验证** → 使用 `npm run build`（检查构建错误）

## 相关文档

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
- [R2 存储文档](https://developers.cloudflare.com/r2/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
