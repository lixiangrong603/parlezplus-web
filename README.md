<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Parlezplus - 法语学习平台

一个全功能的法语教学和学习平台，提供资源管理、练习系统、考试中心等功能，现已优化为 Cloudflare Pages + D1 + R2 架构。

## 🚀 主要特性

- **👨‍🏫 教师端**: 资源管理、学生管理、作业批改、考试出题、数据分析
- **👨‍🎓 学生端**: 资源学习、练习训练、考试答题、成绩查看
- **🎬 多媒体支持**: 视频/音频播放、字幕编辑、录音练习
- **🤖 AI 辅助**: Gemini API 集成（题目生成、文本分析）
- **📊 数据可视化**: 学习进度、考试统计、答题分析
- **🌏 中国优化**: Gemini API 代理、本地化构建、CDN 加速

## 📦 技术栈

### 前端
- **React 19.2.3** - UI 框架
- **TypeScript 5.8.2** - 类型安全
- **Tailwind CSS v4** - 样式系统（本地构建）
- **Vite 6.2.0** - 构建工具（代码分割优化）
- **Lucide React** - 图标库
- **Recharts** - 数据可视化

### 后端（Serverless）
- **Cloudflare Pages** - 静态托管 + Functions
- **Cloudflare D1** - SQLite 数据库（5GB 免费额度）
- **Cloudflare R2** - 对象存储（10GB + 10TB 流量免费）
- **Cloudflare Workers** - 边缘计算 API

### 构建优化
- **代码分割**: 初始包从 2.9MB 降至 307KB（89% 减少）
- **懒加载**: 管理后台组件按需加载
- **Terser 压缩**: 生产环境移除 console.log
- **Bundle 分析**: visualizer 插件监控包大小

## 📂 项目结构

```
parlezplus-web/
├── components/          # React 组件
│   ├── AdminDashboard.tsx          # 管理员仪表盘
│   ├── TeacherDashboard.tsx        # 教师仪表盘
│   ├── StudentDashboard.tsx        # 学生仪表盘
│   ├── PracticeStudio.tsx          # 练习工作室
│   ├── ResourceManagement.tsx      # 资源管理
│   ├── ExamBuilder.tsx             # 考试出题
│   └── ...
├── contexts/            # React Context
│   ├── AuthContext.tsx             # 用户认证
│   ├── JobContext.tsx              # 后台任务
│   └── ModalContext.tsx            # 模态框管理
├── services/            # 业务逻辑
│   ├── api/
│   │   └── client.ts               # API 客户端（新）
│   ├── geminiService.ts            # Gemini API
│   └── azureSpeechService.ts       # Azure 语音
├── utils/               # 工具函数
│   ├── storage.ts                  # 数据存储
│   ├── audioUtils.ts               # 音频处理
│   └── ...
├── functions/           # Cloudflare Workers API（新）
│   ├── _middleware.ts              # 全局 CORS
│   ├── utils.ts                    # JWT/加密工具
│   └── api/
│       ├── auth.ts                 # 登录认证
│       ├── upload.ts               # 文件上传
│       ├── media/[[path]].ts       # 媒体代理
│       ├── proxy-gemini.ts         # Gemini 代理
│       └── resources/[[id]].ts     # 资源 CRUD
├── database/            # 数据库（新）
│   └── schema.sql                  # D1 表结构
├── wrangler.toml        # Cloudflare 配置（新）
├── migrate.html         # 数据迁移工具（新）
└── DEPLOYMENT.md        # 部署文档（新）
```

## 🛠️ 本地开发

### 前置要求
- Node.js 18+
- npm 或 pnpm

### 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 浏览器访问
http://localhost:3000
```

### 使用 Cloudflare Pages 本地环境（推荐）

**连接真实 D1 + R2 环境，与线上保持一致：**

```bash
# 1. 安装依赖
npm install

# 2. 登录 Cloudflare（首次）
npm run login

# 3. 初始化数据库（首次）
npm run db:migrate

# 4. 启动 Wrangler 开发服务器
npm run dev:wrangler

# 5. 浏览器访问
http://localhost:8788
```

> 📘 **详细开发指南**: 查看 [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)

### 方式对比

| 特性 | `npm run dev` | `npm run dev:wrangler` |
|------|---------------|------------------------|
| **HMR 速度** | ⚡ 极快 (~100ms) | 🐢 较慢（需重新构建） |
| **D1 数据库** | ❌ 不可用 | ✅ 本地/远程 D1 |
| **R2 存储** | ❌ 不可用 | ✅ 本地/远程 R2 |
| **API 路由** | ❌ 回退到 localStorage | ✅ 完整 Workers 环境 |
| **适用场景** | UI 快速开发 | API 开发/完整测试 |

### 环境变量

创建 `.dev.vars` 文件（已在 .gitignore 中）：

```bash
JWT_SECRET=your_jwt_secret_here
GEMINI_MASTER_KEY=your_gemini_key  # 可选
AZURE_MASTER_KEY=your_azure_key     # 可选
```

```bash
# 1. 构建前端
npm run build

# 2. 使用 Wrangler 运行（包含 D1/R2/KV）
npm run pages:dev
```

## 🚢 部署到 Cloudflare

详细步骤请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

### 快速部署

```bash
# 1. 登录 Cloudflare
npm run login

# 2. 创建 D1 数据库
npm run db:create
# 获得 database_id 后填入 wrangler.toml

# 3. 初始化数据库表
npm run db:migrate

# 4. 设置环境变量
npx wrangler pages secret put JWT_SECRET
npx wrangler pages secret put GEMINI_MASTER_KEY

# 5. 部署
npm run deploy
```

## 📊 性能指标

| 指标 | 优化前 | 优化后 | 改进 |
|------|--------|--------|------|
| 初始包大小 | 2.9 MB | 307 KB | -89% |
| 首次加载时间 | ~8s (3G) | ~2s (3G) | -75% |
| CDN 节点 | 无 | 全球 330+ | ∞ |
| 数据库延迟 | localStorage | <10ms (边缘) | +快 |

## 🔑 API 文档

### 认证 API
- `POST /api/auth` - 登录获取 JWT token
- `GET /api/auth` - 获取当前用户信息

### 资源 API
- `GET /api/resources?teacherId={id}` - 获取资源列表
- `POST /api/resources` - 创建资源
- `PUT /api/resources/{id}` - 更新资源
- `DELETE /api/resources/{id}` - 删除资源（软删除）

### 文件上传 API
- `POST /api/upload` - 上传文件到 R2
  - 支持文件夹: avatars, videos, audios, covers, recordings, questions

### 媒体代理 API
- `GET /api/media/{r2_key}` - 获取媒体文件
  - 支持 Range 请求（视频流）

### AI 代理 API
- `POST /api/proxy-gemini` - Gemini API 代理（中国访问优化）

## 🌏 中国访问优化

✅ **已实现**:
- Gemini API 反向代理（绕过 GFW）
- 本地构建依赖（无 CDN 依赖）
- Cloudflare 全球 CDN（中国有节点）

🚧 **计划中**:
- 百度文心一言 / 阿里通义千问智能路由
- 七牛云 / 阿里云 OSS 国内双写
- Azure Speech 就近地域路由

## 🗄️ 数据库结构

D1 数据库包含以下表（详见 [database/schema.sql](./database/schema.sql)）:

- `users` - 用户账户（教师/学生/管理员）
- `classrooms` - 班级信息
- `channels` - 课程频道
- `resources` - 教学资源（视频/音频）
- `student_practice_data` - 学生练习数据
- `submissions` - 作业提交
- `syllabus_courses` - 课程大纲
- `question_bank` - 题库
- `exam_papers` - 试卷
- `exam_sessions` - 考试会话
- `operation_logs` - 操作日志
- `user_api_keys` - API 密钥（加密存储）

## 📦 依赖说明

### 核心依赖
- `react` & `react-dom` - UI 框架
- `react-router-dom` - 路由管理
- `lucide-react` - 图标库

### 数据处理
- `recharts` - 图表可视化
- `docx` & `exceljs` - 文档导出
- `file-saver` - 文件下载

### 构建工具
- `@vitejs/plugin-react` - Vite React 插件
- `@tailwindcss/vite` - Tailwind CSS v4
- `terser` - 代码压缩
- `rollup-plugin-visualizer` - Bundle 分析

### 开发工具
- `@cloudflare/workers-types` - Workers 类型定义
- `wrangler` - Cloudflare CLI

## 🔐 环境变量

### Cloudflare Pages Secrets（生产环境）
```bash
JWT_SECRET=your-jwt-secret-key
GEMINI_MASTER_KEY=your-master-encryption-key
AZURE_MASTER_KEY=your-azure-master-key
```

### 本地开发（.env.local）
```bash
VITE_API_BASE_URL=http://localhost:3000
GEMINI_API_KEY=your-gemini-api-key  # 可选，使用代理则不需要
```

## 📝 数据迁移

从 localStorage 迁移到 D1 数据库:

1. 打开 [migrate.html](./migrate.html)
2. 输入管理员账号密码
3. 点击「备份数据」（下载 JSON 文件）
4. 点击「开始迁移」（上传到 D1）

**注意**: 大媒体文件（视频/音频）需要单独上传到 R2

## 🐛 常见问题

### 构建失败: "PostCSS plugin has moved"
- **原因**: Tailwind CSS v4 需要 @tailwindcss/postcss
- **解决**: `npm install -D @tailwindcss/postcss @tailwindcss/vite`

### Wrangler 命令找不到
- **原因**: Wrangler 未全局安装
- **解决**: 使用 `npx wrangler` 或 `npm run login`

### D1 查询失败: "Database not found"
- **原因**: wrangler.toml 中的 database_id 未填写
- **解决**: 运行 `npm run db:create` 获取 ID 并填入配置

### 媒体文件无法播放
- **原因**: R2 bucket 未创建或 wrangler.toml 配置错误
- **解决**: `npx wrangler r2 bucket create parlezplus-media`

更多问题请查看 [DEPLOYMENT.md](./DEPLOYMENT.md#常见问题)

## 🚀 下一步开发

### 待实现 API
- [ ] `/api/users` - 用户管理
- [ ] `/api/classrooms` - 班级管理
- [ ] `/api/exams` - 考试管理
- [ ] `/api/questions` - 题库管理
- [ ] `/api/practice` - 练习数据管理
- [ ] `/api/proxy-azure` - Azure Speech 代理

### 前端重构
- [ ] 使用 `services/api/client.ts` 替换所有 localStorage 调用
- [ ] 实现用户登录/注册流程
- [ ] 媒体上传改为 R2（replacing Base64）
- [ ] 集成 Gemini 代理（replacing 直连）

### 优化增强
- [ ] 实现百度文心一言智能切换
- [ ] 配置国内 CDN 双写
- [ ] 添加单元测试
- [ ] 性能监控和错误追踪

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request!

---

**项目状态**: 🚧 活跃开发中

最后更新: 2025-01-20
