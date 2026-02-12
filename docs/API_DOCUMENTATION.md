# ParlezPlus API 文档

## 概述
本文档详细说明了 ParlezPlus 平台的所有 API 端点、请求/响应格式和使用示例。

---

## 目录
1. [认证](#认证)
2. [用户管理](#用户管理)
3. [班级管理](#班级管理)
4. [题库管理](#题库管理)
5. [考试系统](#考试系统)
6. [练习数据](#练习数据)
7. [批量导入](#批量导入)
8. [Gemini 代理](#gemini-代理)
9. [错误码](#错误码)

---

## 认证

所有 API 请求 (除 `/api/auth/login`) 需要在 HTTP 头中包含 JWT token:
```
Authorization: Bearer <JWT_TOKEN>
```

### 登录
**POST** `/api/auth/login`

**请求体**:
```json
{
  "username": "admin",
  "password": "Admin@2024"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "admin-001",
      "username": "admin",
      "role": "admin",
      "name": "系统管理员"
    }
  }
}
```

---

## 用户管理

### 1. 获取用户列表
**GET** `/api/users`

**查询参数**:
- `role` (可选): 筛选角色 (admin/teacher/student)

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "user-001",
      "username": "teacher1",
      "role": "teacher",
      "name": "张老师",
      "class_id": null,
      "avatar_r2_key": "avatars/teacher1.jpg",
      "created_at": 1700000000000,
      "is_blocked": 0
    }
  ]
}
```

### 2. 创建用户
**POST** `/api/users`

**权限**: 管理员可创建任何角色，教师只能创建学生账户

**请求体**:
```json
{
  "username": "student1",
  "password": "Pass@123",
  "role": "student",
  "name": "张三",
  "class_id": "class-001"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "user-1700000001-abc123"
  }
}
```

### 3. 更新用户信息
**PUT** `/api/users/:id`

**请求体**:
```json
{
  "name": "李四",
  "class_id": "class-002",
  "avatar_r2_key": "avatars/newavatar.jpg",
  "is_blocked": 0
}
```

### 4. 修改密码
**POST** `/api/users/:id/change-password`

**请求体**:
```json
{
  "old_password": "OldPass@123",
  "new_password": "NewPass@456"
}
```

**注意**: 
- 非管理员必须提供旧密码
- 密码要求: 至少 6 个字符

### 5. 删除用户 (软删除)
**DELETE** `/api/users/:id`

**权限**: 仅管理员

**响应**:
```json
{
  "success": true
}
```

### 6. 获取 API 密钥配置状态
**GET** `/api/users/:id/api-keys`

**权限**: 只能查看自己的配置（管理员除外）

**响应**:
```json
{
  "success": true,
  "data": {
    "hasGeminiKey": true,
    "hasAzureKey": true,
    "azureRegion": "westeurope"
  }
}
```

**注意**: 
- 出于安全考虑，不返回实际密钥值，只返回是否已配置
- 密钥在数据库中加密存储（使用 MASTER_KEY）

### 7. 更新 API 密钥
**PUT** `/api/users/:id/api-keys`

**权限**: 只能修改自己的配置（管理员除外）

**请求体**:
```json
{
  "geminiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX",
  "azureKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "azureRegion": "eastasia"
}
```

**参数说明**:
- `geminiKey` (可选): Gemini API 密钥
- `azureKey` (可选): Azure Speech API 密钥
- `azureRegion` (可选): Azure 区域（默认: westeurope）

**响应**:
```json
{
  "success": true
}
```

**安全机制**:
1. 密钥使用 AES-256-GCM 加密存储在数据库中
2. 加密密钥为环境变量 `GEMINI_MASTER_KEY` 或 `AZURE_MASTER_KEY`
3. 每个教师使用自己的 API 密钥，避免共享配额
4. 前端代理调用时自动解密并使用

### 8. 删除 API 密钥
**DELETE** `/api/users/:id/api-keys`

**权限**: 只能删除自己的配置（管理员除外）

**响应**:
```json
{
  "success": true
}
```

---

## 班级管理

### 1. 获取班级列表
**GET** `/api/classrooms`

**角色过滤**:
- 教师: 只看到自己创建的班级
- 学生: 只看到自己所在的班级
- 管理员: 看到所有班级

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "class-001",
      "name": "高一(1)班",
      "user_id": "teacher-001",
      "student_count": 30,
      "students": [
        {
          "id": "s-1",
          "name": "张三",
          "avatar_r2_key": "avatars/student1.jpg",
          "userId": "user-001"
        }
      ],
      "created_at": 1700000000000
    }
  ]
}
```

### 2. 创建班级
**POST** `/api/classrooms`

**请求体**:
```json
{
  "name": "高一(2)班"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "class-1700000002-xyz456"
  }
}
```

### 3. 更新班级
**PUT** `/api/classrooms/:id`

**请求体** (部分更新):
```json
{
  "name": "高一(1)班-重点班",
  "students": [
    {
      "id": "s-1",
      "name": "张三",
      "userId": "user-001"
    }
  ]
}
```

### 4. 添加学生到班级
**POST** `/api/classrooms/:id/students`

**请求体**:
```json
{
  "students": [
    {
      "id": "s-5",
      "name": "王五",
      "userId": "user-005"
    }
  ]
}
```

**功能**:
- 自动去重 (基于 userId)
- 更新用户表的 class_id 字段
- 更新班级学生数量

### 5. 删除班级 (软删除)
**DELETE** `/api/classrooms/:id`

**权限**: 仅班级创建者或管理员

---

## 题库管理

### 1. 获取题目列表
**GET** `/api/questions`

**查询参数**:
- `type` (可选): multiple-choice, fill-blank, true-false, short-answer
- `level` (可选): A1, A2, B1, B2, C1, C2
- `teacherId` (可选): 筛选特定教师的题目
- `includeDeleted` (可选): 包含已删除题目 (仅管理员)

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "q-001",
      "text": "What is the capital of France?",
      "image_r2_key": null,
      "options": [
        {"id": "a", "text": "Paris"},
        {"id": "b", "text": "London"}
      ],
      "correct_option_id": "a",
      "explanation": "Paris is the capital and largest city of France.",
      "type": "multiple-choice",
      "level": "B1",
      "knowledge_point_ids": ["kp-geography-001"],
      "tags": ["geography", "capitals"],
      "created_at": 1700000000000,
      "teacher_id": "teacher-001"
    }
  ]
}
```

### 2. 获取单个题目
**GET** `/api/questions/:id`

**响应**: 同上，返回单个题目详情

### 3. 创建题目
**POST** `/api/questions`

**请求体**:
```json
{
  "text": "Choose the correct verb form",
  "image_r2_key": "questions/q-image-001.jpg",
  "options": [
    {"id": "a", "text": "is"},
    {"id": "b", "text": "are"},
    {"id": "c", "text": "am"},
    {"id": "d", "text": "be"}
  ],
  "correct_option_id": "a",
  "explanation": "Use 'is' with singular subjects.",
  "type": "multiple-choice",
  "level": "A2",
  "knowledge_point_ids": ["kp-grammar-001", "kp-verbs-002"],
  "tags": ["grammar", "present-tense"]
}
```

### 4. 更新题目
**PUT** `/api/questions/:id`

**权限**: 题目创建者或管理员

**请求体**: 同创建，支持部分更新

### 5. 删除题目 (软删除)
**DELETE** `/api/questions/:id`

### 6. 批量创建题目
**POST** `/api/questions/batch`

**请求体**:
```json
{
  "questions": [
    {
      "text": "Question 1",
      "options": [...],
      "correct_option_id": "a"
    },
    {
      "text": "Question 2",
      "options": [...],
      "correct_option_id": "b"
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "created": 2,
    "ids": ["q-001", "q-002"]
  }
}
```

---

## 考试系统

### 试卷管理

#### 1. 获取试卷列表
**GET** `/api/exams/papers`

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "exam-001",
      "title": "期中考试",
      "teacher_id": "teacher-001",
      "sections": [
        {
          "id": "section-1",
          "title": "听力理解",
          "questions": ["q-1", "q-2", "q-3"],
          "score": 30
        }
      ],
      "total_score": 100,
      "assigned_class_ids": ["class-001", "class-002"],
      "assigned_class_deadlines": {
        "class-001": 1700000000000,
        "class-002": 1700100000000
      },
      "exam_taker_settings": {
        "allowReview": true,
        "showCorrectAnswers": false
      },
      "created_at": 1700000000000
    }
  ]
}
```

#### 2. 创建试卷
**POST** `/api/exams/papers`

**请求体**:
```json
{
  "title": "期末考试",
  "sections": [
    {
      "id": "section-1",
      "title": "选择题",
      "questions": ["q-1", "q-2"],
      "score": 50
    }
  ],
  "total_score": 100,
  "assigned_class_ids": ["class-001"],
  "assigned_class_deadlines": {
    "class-001": 1700000000000
  },
  "exam_taker_settings": {
    "allowReview": true,
    "showCorrectAnswers": false
  }
}
```

#### 3. 更新试卷
**PUT** `/api/exams/papers/:id`

#### 4. 删除试卷
**DELETE** `/api/exams/papers/:id`

### 考试会话

#### 5. 获取考试会话列表
**GET** `/api/exams/sessions`

**查询参数**:
- `student_id` (可选): 筛选学生
- `exam_paper_id` (可选): 筛选试卷

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "session-001",
      "exam_paper_id": "exam-001",
      "student_id": "user-001",
      "answers": {
        "q-1": "a",
        "q-2": "b"
      },
      "scores": {
        "q-1": 10,
        "q-2": 0
      },
      "total_score": 10,
      "status": "graded",
      "started_at": 1700000000000,
      "submitted_at": 1700001000000,
      "graded_at": 1700002000000,
      "graded_by": "teacher-001",
      "teacher_feedback": "Good effort, review question 2."
    }
  ]
}
```

#### 6. 创建考试会话 (学生开始考试)
**POST** `/api/exams/sessions`

**请求体**:
```json
{
  "exam_paper_id": "exam-001"
}
```

#### 7. 更新考试会话
**PUT** `/api/exams/sessions/:id`

**学生保存答案**:
```json
{
  "answers": {
    "q-1": "a",
    "q-2": "b"
  },
  "status": "completed"
}
```

**教师批改**:
```json
{
  "scores": {
    "q-1": 10,
    "q-2": 0
  },
  "total_score": 10,
  "status": "graded",
  "teacher_feedback": "Review grammar rules."
}
```

---

## 练习数据

### 练习数据管理

#### 1. 获取练习数据
**GET** `/api/practice`

**查询参数**:
- `user_id` (可选): 筛选用户
- `resource_id` (可选): 筛选资源

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "practice-001",
      "user_id": "user-001",
      "resource_id": "resource-001",
      "quiz_answers": {
        "q-1": "a",
        "q-2": "b"
      },
      "quiz_score": 80,
      "cloze_answers": {
        "blank-1": "is",
        "blank-2": "are"
      },
      "cloze_score": 90,
      "segment_recordings": {
        "seg-1": "recordings/user-001-seg-1.mp3",
        "seg-2": "recordings/user-001-seg-2.mp3"
      },
      "segment_scores": {
        "seg-1": 85,
        "seg-2": 90
      },
      "overall_score": 85,
      "last_practiced_at": 1700000000000,
      "practice_count": 5
    }
  ]
}
```

#### 2. 创建/更新练习数据 (Upsert)
**POST** `/api/practice`

**请求体**:
```json
{
  "resource_id": "resource-001",
  "quiz_answers": {"q-1": "a"},
  "quiz_score": 80,
  "segment_recordings": {
    "seg-1": "recordings/new-recording.mp3"
  },
  "segment_scores": {"seg-1": 85},
  "overall_score": 85
}
```

**逻辑**:
- 如果该用户+资源的记录存在，则更新
- 否则创建新记录

#### 3. 删除练习数据
**DELETE** `/api/practice/:id`

### 提交管理

#### 4. 获取作业提交列表
**GET** `/api/practice/submissions`

**查询参数**:
- `student_id` (可选)
- `resource_id` (可选)
- `status` (可选): pending_review, graded

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "submission-001",
      "resource_id": "resource-001",
      "student_id": "user-001",
      "audio_r2_key": "submissions/user-001-resource-001.mp3",
      "full_recording_r2_key": "submissions/user-001-full.mp3",
      "quiz_results": {
        "score": 80,
        "total": 100
      },
      "segment_scores": {
        "seg-1": 85,
        "seg-2": 90
      },
      "overall_score": 85,
      "status": "graded",
      "submitted_at": 1700000000000,
      "graded_at": 1700001000000,
      "graded_by": "teacher-001",
      "teacher_feedback": "Great pronunciation!"
    }
  ]
}
```

#### 5. 创建作业提交
**POST** `/api/practice/submissions`

**权限**: 仅学生

**请求体**:
```json
{
  "resource_id": "resource-001",
  "audio_r2_key": "submissions/audio.mp3",
  "full_recording_r2_key": "submissions/full.mp3",
  "quiz_results": {"score": 80, "total": 100},
  "segment_scores": {"seg-1": 85},
  "overall_score": 85
}
```

#### 6. 批改作业
**PUT** `/api/practice/submissions/:id`

**权限**: 仅教师

**请求体**:
```json
{
  "teacher_feedback": "Excellent work! Keep practicing.",
  "status": "graded"
}
```

---

## 批量导入

### 批量导入数据
**POST** `/api/import`

**权限**: 仅管理员

**请求体**:
```json
{
  "type": "users",
  "data": [
    {
      "username": "student10",
      "password": "Pass@123",
      "role": "student",
      "name": "学生10"
    }
  ],
  "options": {
    "skipExisting": true,
    "updateExisting": false
  }
}
```

**支持的类型**:
- `users`: 用户
- `resources`: 资源
- `questions`: 题目
- `exams`: 试卷
- `classrooms`: 班级

**响应**:
```json
{
  "success": true,
  "data": {
    "total": 10,
    "created": 8,
    "updated": 0,
    "skipped": 2,
    "errors": [
      {
        "index": 5,
        "error": "用户名已存在"
      }
    ]
  }
}
```

---

## Gemini 代理

### 代理 Gemini API 请求
**POST** `/api/proxy-gemini`

**用途**: 
- 解决中国网络访问 Google Gemini API 的问题
- 通过 Cloudflare Workers 中转请求

**请求体** (Gemini API 格式):
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Translate this to French: Hello, how are you?"
        }
      ]
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "candidates": [
      {
        "content": {
          "parts": [
            {
              "text": "Bonjour, comment allez-vous ?"
            }
          ]
        }
      }
    ]
  }
}
```

**前置条件**:
1. 用户必须在设置中配置 Gemini API Key
2. API Key 加密存储在 `user_api_keys` 表中

---

## 错误码

### HTTP 状态码
- `200 OK`: 请求成功
- `201 Created`: 资源创建成功
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未认证
- `403 Forbidden`: 无权限
- `404 Not Found`: 资源不存在
- `429 Too Many Requests`: API 配额用尽
- `500 Internal Server Error`: 服务器错误

### 错误响应格式
```json
{
  "success": false,
  "error": "错误消息"
}
```

### 常见错误消息
- `"未授权"`: JWT token 无效或缺失
- `"无权限"`: 用户角色不足
- `"缺少必填字段"`: 请求体缺少必要参数
- `"用户名已存在"`: 创建用户时用户名重复
- `"Gemini API Key 无效"`: Gemini 代理时 API Key 错误
- `"Gemini API 配额已用尽"`: Gemini 配额超限

---

## 数据结构参考

### 用户对象
```typescript
interface User {
  id: string;
  username: string;
  role: 'admin' | 'teacher' | 'student';
  name: string;
  class_id?: string | null;
  avatar_r2_key?: string | null;
  is_blocked: number; // 0 = 正常, 1 = 封禁
  needs_password_change: number; // 0 = 否, 1 = 是
  created_at: number; // Unix 时间戳 (毫秒)
  is_deleted?: number;
  deleted_at?: number | null;
  deleted_by?: string | null;
}
```

### 班级对象
```typescript
interface Classroom {
  id: string;
  name: string;
  user_id: string; // 教师ID
  student_count: number;
  students: Array<{
    id: string;
    name: string;
    avatar_r2_key?: string;
    userId: string;
  }>;
  created_at: number;
  is_deleted?: number;
}
```

### 题目对象
```typescript
interface Question {
  id: string;
  teacher_id: string;
  text: string;
  image_r2_key?: string | null;
  options: Array<{ id: string; text: string }>;
  correct_option_id: string;
  explanation?: string | null;
  type: 'multiple-choice' | 'fill-blank' | 'true-false' | 'short-answer';
  level?: string | null; // A1, A2, B1, B2, C1, C2
  knowledge_point_ids: string[];
  tags: string[];
  reading_passage?: string | null;
  sub_questions?: any | null;
  created_at: number;
  created_by: string;
  is_deleted?: number;
}
```

### 试卷对象
```typescript
interface ExamPaper {
  id: string;
  teacher_id: string;
  title: string;
  sections: Array<{
    id: string;
    title: string;
    questions: string[];
    score: number;
  }>;
  total_score: number;
  assigned_class_ids: string[];
  assigned_class_deadlines: Record<string, number>;
  exam_taker_settings?: any;
  created_at: number;
  is_deleted?: number;
}
```

### 考试会话
```typescript
interface ExamSession {
  id: string;
  exam_paper_id: string;
  student_id: string;
  answers: Record<string, any>;
  scores?: Record<string, number>;
  total_score?: number;
  status: 'in_progress' | 'completed' | 'graded';
  started_at: number;
  submitted_at?: number | null;
  graded_at?: number | null;
  graded_by?: string | null;
  teacher_feedback?: string | null;
}
```

---

## 速率限制

当前版本无速率限制，未来可在 Cloudflare Workers 中添加。

建议客户端实现:
- API 请求去抖动 (debounce)
- 批量操作使用批量 API
- 大文件分片上传

---

## 版本历史

### v1.0.0 (2024-01)
- ✅ 初始版本
- ✅ 用户认证系统
- ✅ 班级管理
- ✅ 题库系统
- ✅ 考试系统
- ✅ 练习数据管理
- ✅ 批量导入工具
- ✅ Gemini 代理 (中国网络优化)
