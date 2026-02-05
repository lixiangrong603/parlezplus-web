# 组卷功能 (Exam Builder)

## 功能概述

组卷功能允许教师从题库中心和多媒体资源中选择题目，组成完整的试卷。

## 核心特性

### 1. 试卷基本信息
- ✅ 试卷标题设置
- ✅ 姓名、班级、学号填写区
- ✅ 分数/总分显示

### 2. 多Section结构
- ✅ 可添加多个Section（部分）
- ✅ 每个Section独立配置标题和说明
- ✅ Section可上下移动调整顺序
- ✅ Section可删除

### 3. 题目管理
- ✅ 从题库中心和多媒体资源选择题目
- ✅ 自动过滤已选题目，防止重复
- ✅ 支持多种题型：
  - 选择题 (Multiple Choice)
  - 填空题 (Fill-in-the-blank)
  - 阅读理解 (Reading Comprehension)
  - 完形填空 (Cloze Test)
- ✅ 题目可在Section内上下移动
- ✅ 题目可删除
- ✅ 阅读理解的子题可排序

### 4. 分值设置
- ✅ 单题分值可手动设置
- ✅ 一键设置Section总分，自动均分
- ✅ 阅读理解等复杂题型支持子题分值设置
- ✅ 实时显示Section总分和试卷总分

### 5. 题目排序
- ✅ 支持多级排序条件：
  - 按题型/类别排序
  - 按难度排序
  - 随机排序
- ✅ 可设置升序或降序
- ✅ 排序条件可调整优先级

### 6. 答案查看
- ✅ 一键显示/隐藏所有答案
- ✅ 选择题正确答案高亮显示
- ✅ 填空题和简答题答案卡片展示

### 7. 试卷分析
- ✅ 题目总数统计
- ✅ 总分统计
- ✅ 平均分值计算
- ✅ 各Section占比分析
- ✅ 题型分布统计
- ✅ 难度分布统计
- ✅ 智能建议和警告

### 8. 草稿保存
- ✅ 自动保存草稿到本地
- ✅ 刷新页面后自动恢复
- ✅ 草稿恢复提示
- ✅ 可手动清空草稿

### 9. 试卷管理
- ✅ 保存试卷到数据库
- ✅ 编辑已保存的试卷
- ✅ 删除试卷
- ✅ 试卷列表展示

### 10. 打印样式
- ✅ 简洁的打印布局
- ✅ 隐藏编辑工具栏
- ✅ 优化的试卷头部
- ✅ 适合A4纸张打印

## 使用流程

### 创建新试卷

1. 进入"题库中心"标签页
2. 点击顶部"组卷"按钮
3. 输入试卷标题
4. 点击"添加Section"或使用自动创建的第一个Section
5. 点击Section内的"添加题目"按钮选择题目
6. 调整题目顺序和分值
7. 点击"保存试卷"按钮

### 编辑已有试卷

1. 在试卷列表中找到要编辑的试卷
2. 点击编辑按钮（铅笔图标）
3. 进行修改
4. 点击"保存试卷"保存更改

### 打印试卷

1. 在编辑模式下，点击浏览器的打印功能(Ctrl+P)
2. 选择打印机或PDF
3. 确认打印

### 查看答案

1. 点击顶部工具栏的"查看答案"按钮
2. 答案将以红色高亮显示
3. 再次点击可隐藏答案

## 技术实现

### 新增组件

1. **ExamBuilder.tsx** - 核心组卷组件
2. **QuestionSelector.tsx** - 题目选择器
3. **ExamStemRenderer.tsx** - 试卷题干渲染器
4. **ExamAnalysisModal.tsx** - 试卷分析模态框
5. **SectionSortModal.tsx** - 题目排序模态框

### 新增服务

1. **services/utils.ts** - 选项布局工具函数
2. **services/examAnalysis.ts** - 试卷分析服务

### 数据模型

```typescript
interface ExamItem {
  questionId: string;
  points: number;
  subPoints?: number[]; // 复杂题型的子题分值
}

interface ExamSection {
  id: string;
  title: string;
  instructions: string;
  items: ExamItem[];
}

interface ExamPaper {
  id: string;
  title: string;
  sections: ExamSection[];
  totalScore: number;
  teacherId: string;
  createdAt: number;
  sharedWith?: string[];
}
```

### 存储服务

```typescript
// 试卷CRUD操作
getExamPapers(teacherId?: string): ExamPaper[]
getExamPaperById(id: string): ExamPaper | undefined
saveExamPaper(exam: ExamPaper): ExamPaper
updateExamPaper(exam: ExamPaper): void
deleteExamPaper(id: string): void

// 题目批量获取
getQuestionsByIds(ids: string[]): Promise<Question[]>
```

## 待实现功能

### PDF导出
- 需要集成 html2pdf.js 或 jsPDF
- 保留完整样式和格式
- 支持多页文档

### Word导出
- 需要集成 docx.js
- 生成标准Word文档格式
- 支持图片和特殊格式

### 试卷分享
- 支持分享给班级或学生
- 生成分享链接
- 设置访问权限

### 在线答题
- 学生在线答题功能
- 自动批改客观题
- 成绩统计和分析

## 样式特点

- 简洁优雅的试卷风格
- 模仿传统纸质试卷布局
- 打印友好的样式设计
- 响应式布局，支持移动端查看
- 深色模式支持（编辑模式）

## 注意事项

1. 试卷草稿存储在浏览器localStorage中
2. 清除浏览器缓存会导致草稿丢失
3. 建议及时保存重要试卷
4. 阅读理解等复杂题型会自动计算总分
5. 排序操作不可撤销，请谨慎使用

## 快捷操作

- **Ctrl+P**: 打印试卷
- **点击Section控制栏**: 展开更多操作
- **Hover题目**: 显示操作按钮
- **双击Section标题**: 快速编辑
