# ParlezPlus 环境变量配置指南

## 问题说明
Cloudflare Pages Dashboard 显示 "managed through wrangler.toml" 是正常的，这表示项目配置由代码管理。但**环境变量（Secrets）仍需手动设置一次**。

## 快速设置步骤

### 1️⃣ 设置 JWT_SECRET（必需）

```powershell
# 生成随机密钥
$JWT_SECRET = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "生成的 JWT_SECRET: $JWT_SECRET"

# 设置到 Cloudflare Pages
npx wrangler pages secret put JWT_SECRET --project-name=fluide
# 输入提示时，粘贴上面生成的密钥
```

### 2️⃣ 设置加密主密钥（可选，推荐）

用于加密存储每个教师的 API Keys：

```powershell
# 生成主密钥
$MASTER_KEY = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "生成的 MASTER_KEY: $MASTER_KEY"

# 设置到 Cloudflare Pages
npx wrangler pages secret put GEMINI_MASTER_KEY --project-name=fluide
# 粘贴上面生成的密钥

# 如果需要单独的 Azure 加密密钥（或使用同一个）
npx wrangler pages secret put AZURE_MASTER_KEY --project-name=fluide
```

### 3️⃣ 验证配置

```powershell
# 查看项目环境变量（不显示值）
npx wrangler pages secret list --project-name=parlezplus
```

## 为什么 Dashboard 配置会消失？

- ✅ **D1 数据库绑定**：通过 `wrangler.toml` 管理（已配置）
- ✅ **环境变量（非敏感）**：通过 `wrangler.toml` 的 `[vars]` 管理
- ❌ **敏感密钥（Secrets）**：**必须通过 CLI 设置，不能在 wrangler.toml 中明文存储**

GitHub Actions 部署时会读取 wrangler.toml，但**不会覆盖已设置的 Secrets**。

## 配置持久性

✅ 通过 `wrangler pages secret put` 设置的环境变量**永久保存**在 Cloudflare 云端  
✅ 每次 GitHub Actions 部署**不会影响**这些 Secrets  
✅ 只需设置**一次**，除非需要更改  

## 常见问题

**Q: 我之前在 Dashboard 设置的变量去哪了？**  
A: Cloudflare 检测到 wrangler.toml 后，优先使用文件配置，Dashboard UI 被禁用。但通过 CLI 设置的 Secrets 仍然有效。

**Q: 每次部署都要重新设置吗？**  
A: 不需要！Secrets 只需设置一次，会持久保存。

**Q: 如何查看当前设置的 Secrets？**  
A: 运行 `npx wrangler pages secret list --project-name=fluide`（只显示名称，不显示值）

**Q: 如何删除某个 Secret？**  
A: `npx wrangler pages secret delete JWT_SECRET --project-name=fluide`

## 测试登录

配置完成后，访问 https://fluide.pages.dev 测试：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin  | Admin@2024 | 管理员 |
| teacher | Admin@2024 | 教师 |
| student | Admin@2024 | 学生 |
