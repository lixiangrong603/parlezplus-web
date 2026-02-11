# 本地开发配置完成 ✅

## 已完成的配置

### 1. **环境变量配置**
- ✅ 创建 `.dev.vars` 文件用于存储本地开发密钥
- ✅ 更新 `.gitignore` 防止敏感信息泄露
- ✅ 添加默认 JWT_SECRET 用于本地开发

### 2. **开发脚本更新**
新增以下 npm 脚本：

```json
{
  "dev:wrangler": "构建后启动 Wrangler Pages Dev（完整 D1+R2 环境）",
  "dev:quick": "一键启动脚本（自动检测和初始化）",
  "build:watch": "监听模式构建（配合 Wrangler 使用）",
  "db:reset": "重置本地数据库",
  "db:local": "执行本地数据库操作"
}
```

### 3. **快速启动脚本**
创建了两个自动化脚本：
- ✅ `dev-start.ps1` - Windows PowerShell 版本
- ✅ `dev-start.sh` - Linux/Mac Bash 版本

这些脚本会自动：
1. 检查 Cloudflare 登录状态
2. 创建 .dev.vars（如果不存在）
3. 初始化本地数据库
4. 启动开发服务器

### 4. **文档完善**
- ✅ `LOCAL_DEVELOPMENT.md` - 详细开发指南
- ✅ 更新 `README.md` - 添加快速入门部分
- ✅ 更新 `wrangler.toml` - 添加本地开发说明

## 🚀 快速开始

### 方式 1: 使用自动化脚本（最简单）

**Windows:**
```powershell
npm run dev:quick
```

**Linux/Mac:**
```bash
chmod +x dev-start.sh
./dev-start.sh
```

### 方式 2: 手动启动（推荐用于开发）

**终端 1 - 监听构建:**
```bash
npm run build:watch
```

**终端 2 - 开发服务器:**
```bash
npm run pages:dev
```

### 方式 3: 一次性启动
```bash
npm run dev:wrangler
```

## 📊 不同模式对比

| 模式 | 命令 | D1 | R2 | HMR | 适用场景 |
|------|------|----|----|-----|----------|
| **Vite Dev** | `npm run dev` | ❌ | ❌ | ✅ | 纯前端开发 |
| **Wrangler Dev** | `npm run dev:wrangler` | ✅ | ✅ | ❌ | API 开发/测试 |
| **Watch + Pages** | 两个终端 | ✅ | ✅ | ~⚡ | 完整开发（推荐） |
| **Quick Start** | `npm run dev:quick` | ✅ | ✅ | ❌ | 快速验证 |

## 🔧 常用操作

### 查看本地数据库数据
```bash
npx wrangler d1 execute parlezplus_db --local --command="SELECT * FROM users"
```

### 重置本地数据库
```bash
npm run db:reset
```

### 查看 R2 本地文件
```bash
ls .wrangler/state/v3/r2/parlezplus-media/
```

### 使用远程 D1/R2（而非本地模拟）
```bash
npx wrangler pages dev dist --remote
```
⚠️ **警告**: 这会直接操作生产数据！

## 📝 下一步

1. **启动开发环境**:
   ```bash
   npm run dev:quick
   ```

2. **访问应用**: http://localhost:8788

3. **测试登录**:
   - 默认管理员账号（根据 seed.sql）
   - Username: `admin` / Password: `admin123`

4. **开始开发**: 修改代码并刷新浏览器

## 🐛 常见问题排查

### 问题: "Database not found"
**解决**: 运行数据库迁移
```bash
npm run db:migrate
```

### 问题: "Cannot find module 'dist/...'"
**解决**: 先构建前端
```bash
npm run build
```

### 问题: API 返回 401 Unauthorized
**解决**: 检查 .dev.vars 中的 JWT_SECRET

### 问题: 上传文件失败
**解决**: R2 本地模拟需要写权限，检查 .wrangler/ 目录权限

## 📚 相关文档

- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) - 详细开发指南
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署说明
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API 文档
- [Cloudflare Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)

## ✅ 配置检查清单

- [x] Wrangler CLI 已安装（v4.63.0）
- [x] D1 数据库已创建（parlezplus_db）
- [x] R2 存储桶已配置（parlezplus-media）
- [x] .dev.vars 文件已创建
- [x] .gitignore 已更新
- [x] 开发脚本已添加
- [x] 文档已完善

---

**配置完成时间**: 2026-02-11  
**配置版本**: v1.0  
**Status**: ✅ Ready for Development
