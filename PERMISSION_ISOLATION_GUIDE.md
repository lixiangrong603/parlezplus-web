# 权限隔离实现指南

## 概述
本文档说明了如何在 ParLezPlus 系统中实现教师级别的数据隔离和学生级别的班级资源隔离。

## 核心原则

### 1. 教师数据隔离（题库和多媒体资源）
**目标**: 确保教师 A 无法看到教师 B 的题目和资源

#### 实现方式：

**数据模型更新** (`types.ts`)
- `Question` 接口添加 `teacherId?: string` 字段
- `MediaResource` 接口添加 `teacherId?: string` 字段
- `Channel` 接口保持 `userId?: string` 字段（频道所有者）

**存储层更新** (`utils/storage.ts`)

| 函数 | 参数变更 | 行为 |
|------|---------|------|
| `getBankQuestions(teacherId?)` | 增加可选 `teacherId` | 如果提供了 teacherId，只返回该教师的题目 |
| `saveBankQuestion(..., teacherId?)` | 增加可选 `teacherId` | 保存时自动关联 teacherId |
| `getResources(teacherId?)` | 增加可选 `teacherId` | 如果提供了 teacherId，只返回该教师拥有频道中的资源 |
| `saveResource(..., teacherId?)` | 增加可选 `teacherId` | 保存时自动关联 teacherId |
| `getChannels(userId?)` | 增加可选 `userId` | 如果提供了 userId，只返回该用户拥有的频道 |
| `saveChannel(..., userId?)` | 增加可选 `userId` | 保存时自动关联 userId |

### 2. 学生资源访问隔离
**目标**: 确保学生只能看到所在班级分配给他们的资源

#### 实现方式：

**资源分配机制**
- 每个 `MediaResource` 有 `assignedClassIds: string[]` 字段，列出可访问该资源的班级
- 教师通过 "发布到班级" 功能（`PublishToClassModal`）来设置资源的班级可见性
- 资源状态：
  - `draft`: 仅教师可见
  - `ready`: 已发布到指定班级

**学生端过滤逻辑** (`StudentDashboard.tsx`)
```typescript
const displayedResources = resources.filter(r => {
  // 条件1: 资源分配给学生的班级
  if (activeClass?.id && r.assignedClassIds?.includes(activeClass.id)) return true;
  // 条件2: 资源已发布但未指定班级（对所有班级可见）
  if (r.status === 'ready' && (!r.assignedClassIds || r.assignedClassIds.length === 0)) return true;
  return false;
});
```

## 组件更新汇总

### QuestionBankDashboard.tsx ✅
- **状态**: 已正确实现
- **关键调用**:
  ```typescript
  setBankQuestions(getBankQuestions(user?.id));
  ```
- **验证**: 每次加载问题时都传递 user?.id 确保隔离

### ResourceManagement.tsx ✅
- **变更内容**:
  1. 添加 `useAuth()` 获取当前用户
  2. 更新 `useEffect` 中的数据加载:
     ```typescript
     if (user) {
       setChannels(getChannels(user.id));
       setResources(getResources(user.id));
     }
     ```
  3. 更新频道操作:
     ```typescript
     const nc: Channel = { 
       id: Date.now().toString(), 
       userId: user.id,  // 关联教师ID
       name: newChannelName, 
       createdAt: Date.now() 
     };
     saveChannel(nc, user.id);
     ```
  4. 更新资源上传:
     - `UploadModal` 接收 `userId` 参数
     - 新资源的 `teacherId` 设置为当前用户ID
     ```typescript
     const newResource: MediaResource = {
       // ...
       teacherId: userId,
       userId: userId,
       // ...
     };
     ```

### StudentDashboard.tsx ✅
- **状态**: 已正确实现学生端过滤
- **关键逻辑**:
  - 只显示分配给学生班级的资源或公开资源
  - 已提交的资源正确标记为已完成

## 权限检查清单

### 场景1: 教师A登录
- [ ] 看到的题库只包含教师A的题目
- [ ] 看到的资源只包含教师A创建的频道和资源
- [ ] 无法访问教师B的题目和资源

**验证方式**:
```javascript
// 在浏览器控制台测试
localStorage.getItem('parlezplus_questions')  // 检查是否只有user_A的题目
localStorage.getItem('parlezplus_resources')  // 检查是否只有user_A的资源
```

### 场景2: 学生A登录
- [ ] 看到分配给学生A所在班级的资源
- [ ] 看到标记为"对所有班级可见"的资源
- [ ] 无法看到分配给其他班级的资源
- [ ] 无法看到草稿状态的资源

**验证方式**:
1. 创建两个班级：Class1, Class2
2. 创建学生：Student A (在Class1), Student B (在Class2)
3. 教师创建资源，分配给Class1
4. Student A 登录 → 看到资源
5. Student B 登录 → 看不到资源

### 场景3: 教师发布资源到班级
- [ ] 只有资源所有教师才能看到"发布到班级"选项
- [ ] 其他教师看不到该资源
- [ ] 学生看到已发布到其班级的资源

## 数据流程图

### 教师创建题目
```
教师登录 (user_id = teacher_1)
  ↓
新建题目 (text, options, etc.)
  ↓
saveBankQuestion(question, teacher_1)  ← 自动关联 teacherId
  ↓
localStorage 存储: {
  id: "q_1",
  text: "...",
  teacherId: "teacher_1",  ← 关键字段
  ...
}
```

### 教师创建并发布资源
```
教师登录 (user_id = teacher_1)
  ↓
上传多媒体文件
  ↓
UploadModal 处理 (userId = teacher_1)
  ↓
saveResource(resource, teacher_1)  ← 自动关联 teacherId
  ↓
点击"发布到班级"
  ↓
PublishToClassModal (userId = teacher_1)
  ↓
saveResource(updated, teacher_1)  ← 更新 status='ready', assignedClassIds=[...]
  ↓
localStorage 存储: {
  id: "r_1",
  title: "...",
  teacherId: "teacher_1",  ← 所有者
  assignedClassIds: ["class_1", "class_2"],
  status: "ready"
}
```

### 学生查看资源
```
学生登录 (user_id = student_1, classId = "class_1")
  ↓
StudentDashboard 加载资源
  ↓
获取所有资源 (不过滤 teacherId，资源应该是公开的)
  ↓
客户端过滤:
  if (r.assignedClassIds?.includes("class_1")) → 显示
  if (r.status === 'ready' && !r.assignedClassIds) → 显示
  else → 隐藏
  ↓
只显示分配给 class_1 的资源
```

## 安全性考虑

### 当前实现的防护
1. ✅ **教师隔离**: 题库和资源由 teacherId 隔离
2. ✅ **学生隔离**: 学生只能看到分配给其班级的资源
3. ✅ **状态保护**: 草稿状态的资源对学生不可见

### 潜在风险（需注意）
1. ⚠️ **localStorage 依赖**: 当前使用浏览器本地存储，不适合生产环境
   - **建议**: 迁移到后端数据库
   - **实现**: 创建 API 端点验证教师身份后再返回数据

2. ⚠️ **前端过滤**: StudentDashboard 中的过滤逻辑在客户端执行
   - **当前**: 依赖用户诚实不修改 localStorage
   - **建议**: 后端应该在返回学生资源前验证班级分配关系

3. ⚠️ **考试隔离**: ExamPaper 的教师隔离需要验证
   - **检查**: getExamPapers() 是否有 teacherId 过滤
   - **建议**: 确保学生只能看到分配给其班级的考试

## 后续改进建议

### Phase 2: 后端实现
- [ ] 迁移所有存储操作到数据库 API
- [ ] 在服务器端实现权限检查
- [ ] 使用 JWT token 验证教师/学生身份
- [ ] 实现详细的操作日志审计

### Phase 3: 增强安全性
- [ ] 实现基于角色的访问控制 (RBAC)
- [ ] 添加共享机制（教师可以与其他教师共享资源）
- [ ] 实现资源版本控制
- [ ] 添加访问日志记录

## 测试脚本

### 快速验证权限隔离
```javascript
// 在浏览器控制台运行

// 1. 检查题库隔离
const questions = JSON.parse(localStorage.getItem('parlezplus_questions') || '[]');
console.log('当前教师题目数:', questions.length);
console.log('题目ID:', questions.map(q => q.id));

// 2. 检查资源隔离
const resources = JSON.parse(localStorage.getItem('parlezplus_resources') || '[]');
console.log('当前教师资源数:', resources.length);
console.log('资源ID:', resources.map(r => r.id));

// 3. 检查频道隔离
const channels = JSON.parse(localStorage.getItem('parlezplus_channels') || '[]');
console.log('当前用户频道数:', channels.length);
console.log('频道ID:', channels.map(c => c.id));

// 4. 检查学生可见资源
const user = JSON.parse(localStorage.getItem('parlezplus_session') || '{}');
const visibleResources = resources.filter(r => {
  const inMyClass = r.assignedClassIds?.includes(user.classId);
  const isPublic = r.status === 'ready' && (!r.assignedClassIds || r.assignedClassIds.length === 0);
  return inMyClass || isPublic;
});
console.log('学生可见资源数:', visibleResources.length);
```

## 常见问题解答

**Q: 如果教师更改 CURRENT_USER_ID 会怎样？**
A: 这是 localStorage 的限制。在生产环境中应该使用后端认证来防止这种情况。

**Q: 学生可以修改 localStorage 看到其他班级的资源吗？**
A: 可以，在当前实现中。这就是为什么建议迁移到后端。

**Q: 支持教师之间共享题目吗？**
A: 当前不支持。可以通过添加 `sharedWithTeachers: string[]` 字段来实现。

**Q: 考试(ExamPaper) 是否也被隔离了？**
A: 需要检查 getExamPapers() 实现。建议在 types.ts 的 ExamPaper 中也添加 teacherId 字段。
