# 新头像系统说明

## ✨ 改进内容

### 1. 头像显示逻辑
- **有上传头像**：显示用户上传的 base64 图片（最大5MB，自动压缩至400x400px）
- **无上传头像**：显示基于真实姓名的**主题协调色首字母圆圈**

### 2. 首字母提取规则
- **中文姓名**：显示第一个汉字（如"张三" → "张"）
- **英文姓名**：显示首字母大写（如"Alice Zhang" → "A"）

### 3. 颜色方案
使用**12种预设主题色**，与网站 indigo/purple 主题协调：
- indigo-500 (#6366f1)
- violet-500 (#8b5cf6)
- purple-500 (#a855f7)
- pink-500 (#ec4899)
- rose-500 (#f43f5e)
- emerald-500 (#10b981)
- teal-500 (#14b8a6)
- cyan-500 (#06b6d4)
- blue-500 (#3b82f6)
- amber-500 (#f59e0b)
- red-500 (#ef4444)

**特点**：
- 同一用户始终显示相同颜色（基于 userId/name 哈希）
- 替代了之前随机生成的 HSL 颜色，视觉更统一

## 🔧 技术实现

### 已更新的组件
1. **TeacherDashboard.tsx** - 教师仪表板头像按钮
2. **StudentDashboard.tsx** - 学生仪表板头像按钮
3. **StudentRoster.tsx** - 学生名册卡片
4. **SubmissionManager.tsx** - 作业提交列表
5. **ExamGradingManager.tsx** - 试卷批阅学生列表

### 核心工具函数 (utils/mediaUtils.ts)
```typescript
// 提取首字母
export const getInitials = (name: string): string => {
  if (!name.trim()) return '?';
  const isChinese = /[\u4e00-\u9fa5]/.test(name[0]);
  return isChinese ? name[0] : name[0].toUpperCase();
};

// 生成主题协调色
export const getColorFromString = (str: string): string => {
  const themeColors = ['#6366f1', '#8b5cf6', '#a855f7', ...];
  const hash = str.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
  return themeColors[Math.abs(hash) % themeColors.length];
};
```

### 条件渲染模板
```tsx
{user.avatar ? (
  <img 
    src={user.avatar} 
    className="w-full h-full rounded-full object-cover"
  />
) : (
  <div 
    className="w-full h-full rounded-full flex items-center justify-center text-white font-black"
    style={{ backgroundColor: getColorFromString(user.id || user.name) }}
  >
    {getInitials(user.name)}
  </div>
)}
```

## 🧹 旧数据清理

### 自动清理机制
应用首次启动时自动运行 `cleanAllAvatars()`：
- 删除 localStorage 中所有用户的 `avatar` 字段
- 删除所有班级学生的 `avatar` 字段
- 清理完成后标记 `parlezplus_avatars_cleaned: true`，避免重复清理

### 清理脚本 (utils/cleanAvatars.ts)
```typescript
import { cleanAllAvatars } from './utils/cleanAvatars';

// 手动触发清理（开发调试用）
cleanAllAvatars();
// 输出: ✅ 清理完成！
//        - 用户头像: 3 条
//        - 学生头像: 15 条
```

## 📋 测试清单

### 1. 清空浏览器缓存
```
localStorage.removeItem('parlezplus_avatars_cleaned');
```
刷新页面，查看控制台是否输出清理日志。

### 2. 检查头像显示
- ✅ 教师仪表板右上角头像
- ✅ 学生仪表板右上角头像
- ✅ 学生名册中的学生卡片
- ✅ 作业批阅管理器的学生列表
- ✅ 试卷批阅管理器的学生列表

### 3. 上传新头像
- 进入设置面板 → 个人资料
- 上传头像图片（JPG/PNG/WEBP，<5MB）
- 保存后刷新，验证显示上传的图片

### 4. 删除头像
- 进入设置面板 → 个人资料
- 点击"删除"按钮
- 保存后刷新，验证显示首字母圆圈（主题色）

## 🎨 视觉效果对比

### 之前（pravatar.cc 外部服务）
- ❌ 依赖外部 CDN，离线不可用
- ❌ 隐私问题（用户ID暴露）
- ❌ 无法自定义

### 现在（本地首字母头像）
- ✅ 完全本地化，离线可用
- ✅ 主题色协调，视觉统一
- ✅ 支持用户自定义上传
- ✅ 中英文姓名智能识别
- ✅ 同一用户颜色一致

## 🔍 故障排查

### 问题：头像仍显示旧的 pravatar.cc 图片
**解决方案**：
1. 打开浏览器控制台 (F12)
2. 运行：`localStorage.removeItem('parlezplus_avatars_cleaned')`
3. 刷新页面，等待自动清理完成

### 问题：头像圆圈颜色不协调
**检查**：确认 `utils/mediaUtils.ts` 中 `getColorFromString()` 使用了预设的12种主题色数组。

### 问题：中文姓名显示首字母而非汉字
**检查**：确认 `getInitials()` 函数的正则判断 `/[\u4e00-\u9fa5]/` 正常工作。

## 📦 相关文件

- `utils/mediaUtils.ts` - 头像工具函数
- `utils/cleanAvatars.ts` - 旧数据清理脚本
- `App.tsx` - 启动时自动清理集成
- `components/TeacherDashboard.tsx`
- `components/StudentDashboard.tsx`
- `components/StudentRoster.tsx`
- `components/SubmissionManager.tsx`
- `components/ExamGradingManager.tsx`
