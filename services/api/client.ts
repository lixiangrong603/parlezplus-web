// 前端 API 客户端 - 替代 localStorage 调用

import type { User } from '../../types/worker';

// API 基础 URL (生产环境和开发环境都使用相对路径)
// 开发环境：Vite dev server 会返回 404，立即失败，不会卡住
// 生产环境：Cloudflare Pages Functions 处理 API 请求
const API_BASE_URL = '';

// ============================================
// HTTP 客户端
// ============================================

class ApiClient {
  private token: string | null = null;

  constructor() {
    // 从 localStorage 读取 token
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json() as { data: T };
    return data.data;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  }

  async uploadFile(file: File, folder: string): Promise<{ r2_key: string; cdn_url: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
      throw new Error(error.error || `Upload failed: HTTP ${response.status}`);
    }

    const data = await response.json() as { data: { r2_key: string; cdn_url: string; size: number } };
    return data.data;
  }
}

export const apiClient = new ApiClient();

// ============================================
// 认证 API
// ============================================

// 将后端返回的蛇形命名用户对象转换为前端驼峰命名
function transformUserFromApi(apiUser: any): any {
  // 安全检查：如果 apiUser 为空，直接返回 null
  if (!apiUser) {
    return null;
  }
  
  return {
    ...apiUser,
    // 关键字段映射：蛇形 → 驼峰，确保布尔字段返回明确的 true/false
    classId: apiUser.class_id ?? apiUser.classId,
    needsPasswordChange: Boolean(apiUser.needs_password_change === 1 || apiUser.needs_password_change === true || apiUser.needsPasswordChange === true),
    isBlocked: Boolean(apiUser.is_blocked === 1 || apiUser.is_blocked === true || apiUser.isBlocked === true),
    isDeleted: Boolean(apiUser.is_deleted === 1 || apiUser.is_deleted === true || apiUser.isDeleted === true),
    deletedAt: apiUser.deleted_at ?? apiUser.deletedAt,
    deletedBy: apiUser.deleted_by ?? apiUser.deletedBy,
  };
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const result = await apiClient.post<{ token: string; user: any }>('/api/auth', {
    username,
    password,
  });
  
  apiClient.setToken(result.token);
  return {
    token: result.token,
    user: transformUserFromApi(result.user),
  };
}

export async function getCurrentUser(): Promise<User> {
  const apiUser = await apiClient.get<any>('/api/auth');
  return transformUserFromApi(apiUser);
}

export function logout() {
  apiClient.clearToken();
}

// ============================================
// 资源 API
// ============================================

export async function getResources(teacherId?: string, includeDeleted?: boolean, summary?: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  if (teacherId) params.append('teacherId', teacherId);
  if (includeDeleted) params.append('includeDeleted', 'true');
  if (summary) params.append('summary', 'true');
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/resources${queryString ? `?${queryString}` : ''}`);
}

export async function createResource(resource: any): Promise<{ id: string; created_at: number }> {
  return apiClient.post<{ id: string; created_at: number }>('/api/resources', resource);
}

export async function updateResource(id: string, updates: any): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/resources/${id}`, updates);
}

export async function deleteResource(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/api/resources/${id}`);
}

// ============================================
// 文件上传 API
// ============================================

export async function uploadAvatar(file: File): Promise<string> {
  const result = await apiClient.uploadFile(file, 'avatars');
  return result.cdn_url;
}

export async function uploadVideo(file: File): Promise<string> {
  const result = await apiClient.uploadFile(file, 'videos');
  return result.cdn_url;
}

export async function uploadAudio(file: File): Promise<string> {
  const result = await apiClient.uploadFile(file, 'audios');
  return result.cdn_url;
}

export async function uploadCover(file: File): Promise<string> {
  const result = await apiClient.uploadFile(file, 'covers');
  return result.cdn_url;
}

export async function uploadRecording(blob: Blob): Promise<string> {
  const file = new File([blob], `recording-${Date.now()}.wav`, { type: 'audio/wav' });
  const result = await apiClient.uploadFile(file, 'recordings');
  return result.cdn_url;
}

// ============================================
// Gemini API 代理
// ============================================

export async function callGeminiAPI(body: any): Promise<any> {
  return apiClient.post<any>('/api/proxy-gemini', body);
}

// ============================================
// 媒体 URL 辅助函数
// ============================================

/**
 * 获取媒体文件的完整 URL
 * @param r2Key - R2 存储路径或 CDN URL
 */
export function getMediaUrl(r2Key: string | null | undefined): string {
  if (!r2Key) return '';
  
  // 如果已经是完整 URL，直接返回
  if (r2Key.startsWith('http://') || r2Key.startsWith('https://') || r2Key.startsWith('/api/media/')) {
    return r2Key;
  }
  
  // 否则构建 CDN URL
  return `${API_BASE_URL}/api/media/${r2Key}`;
}

// ============================================
// 班级 API
// ============================================

export async function getClassrooms(teacherId?: string, includeDeleted?: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  if (teacherId) params.append('teacherId', teacherId);
  if (includeDeleted) params.append('includeDeleted', 'true');
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/classrooms${queryString ? `?${queryString}` : ''}`);
}

export async function createClassroom(data: { name: string; teacherId?: string }): Promise<any> {
  return apiClient.post<any>('/api/classrooms', data);
}

export async function updateClassroom(id: string, updates: any): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/classrooms/${id}`, updates);
}

export async function deleteClassroom(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/api/classrooms/${id}`);
}

// ============================================
// 频道 API
// ============================================

export async function getChannels(teacherId?: string, includeDeleted?: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  if (teacherId) params.append('teacherId', teacherId);
  if (includeDeleted) params.append('includeDeleted', 'true');
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/channels${queryString ? `?${queryString}` : ''}`);
}

export async function createChannel(data: { name: string }): Promise<any> {
  return apiClient.post<any>('/api/channels', data);
}

export async function updateChannel(id: string, updates: { name: string }): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/channels/${id}`, updates);
}

export async function deleteChannel(id: string, operatorId?: string, reason?: string): Promise<{ success: boolean }> {
  const body = operatorId || reason ? { operatorId, reason } : undefined;
  return apiClient.delete<{ success: boolean }>(`/api/channels/${id}`, body);
}

// ============================================
// 课程大纲 API
// ============================================

export async function getSyllabusCourses(teacherId?: string, includeDeleted?: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  if (teacherId) params.append('teacherId', teacherId);
  if (includeDeleted) params.append('includeDeleted', 'true');
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/syllabus${queryString ? `?${queryString}` : ''}`);
}

export async function createSyllabusCourse(data: { name: string; units?: any[] }): Promise<any> {
  return apiClient.post<any>('/api/syllabus', data);
}

export async function updateSyllabusCourse(id: string, updates: { name?: string; units?: any[] }): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/syllabus/${id}`, updates);
}

export async function deleteSyllabusCourse(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/api/syllabus/${id}`);
}

// ============================================
// 题库 API
// ============================================

export async function getQuestions(teacherId?: string, type?: string, level?: string, includeDeleted?: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  if (teacherId) params.append('teacherId', teacherId);
  if (type) params.append('type', type);
  if (level) params.append('level', level);
  if (includeDeleted) params.append('includeDeleted', 'true');
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/questions${queryString ? `?${queryString}` : ''}`);
}

export async function getQuestionById(id: string): Promise<any> {
  if (!id) throw new Error('Missing question id');
  return apiClient.get<any>(`/api/questions/${id}`);
}

export async function createQuestion(data: any): Promise<any> {
  return apiClient.post<any>('/api/questions', data);
}

export async function updateQuestion(id: string, updates: any): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/questions/${id}`, updates);
}

export async function deleteQuestion(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/api/questions/${id}`);
}

// ============================================
// 试卷 API
// ============================================

export async function getExamPapers(teacherId?: string, includeDeleted?: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  if (teacherId) params.append('teacherId', teacherId);
  if (includeDeleted) params.append('includeDeleted', 'true');
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/exams${queryString ? `?${queryString}` : ''}`);
}

export async function createExamPaper(data: any): Promise<any> {
  return apiClient.post<any>('/api/exams', data);
}

export async function updateExamPaper(id: string, updates: any): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/exams/papers/${id}`, updates);
}

export async function deleteExamPaper(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/api/exams/papers/${id}`);
}

// ============================================
// 试卷文件夹 API
// ============================================

export async function getExamFolders(teacherId?: string): Promise<any[]> {
  const queryParam = teacherId ? `?teacherId=${teacherId}` : '';
  return apiClient.get<any[]>(`/api/exam-folders${queryParam}`);
}

export async function createExamFolder(data: { name: string }): Promise<any> {
  return apiClient.post<any>('/api/exam-folders', data);
}

export async function updateExamFolder(id: string, updates: { name: string }): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/exam-folders/${id}`, updates);
}

export async function deleteExamFolder(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/api/exam-folders/${id}`);
}

// ============================================
// 考试会话 API
// ============================================

export async function getExamSessions(examId?: string, studentId?: string, includeDeleted?: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  if (examId) params.append('examId', examId);
  if (studentId) params.append('studentId', studentId);
  if (includeDeleted) params.append('includeDeleted', 'true');
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/exams/sessions${queryString ? `?${queryString}` : ''}`);
}

// 批量获取考试会话（按多个考试ID和班级ID）- 性能优化
export async function getExamSessionsByExamsAndClass(examIds: string[], classId: string, includeDeleted?: boolean): Promise<any[]> {
  if (examIds.length === 0) return [];
  const params = new URLSearchParams();
  params.append('examIds', examIds.join(','));
  params.append('classId', classId);
  if (includeDeleted) params.append('includeDeleted', 'true');
  return apiClient.get<any[]>(`/api/exams/sessions?${params.toString()}`);
}

export async function createExamSession(data: any): Promise<any> {
  return apiClient.post<any>('/api/exams/sessions', data);
}

export async function updateExamSession(id: string, updates: any): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/exams/sessions/${id}`, updates);
}

export async function deleteExamSession(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/api/exams/sessions/${id}`);
}

// ============================================
// 学生练习数据 API
// ============================================

export async function getPracticeData(userId?: string, resourceId?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (userId) params.append('userId', userId);
  if (resourceId) params.append('resourceId', resourceId);
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/practice${queryString ? `?${queryString}` : ''}`);
}

export async function savePracticeData(data: any): Promise<any> {
  return apiClient.post<any>('/api/practice', data);
}

// ============================================
// 作业提交 API
// ============================================

export async function getSubmissions(studentId?: string, resourceId?: string, status?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (studentId) params.append('studentId', studentId);
  if (resourceId) params.append('resourceId', resourceId);
  if (status) params.append('status', status);
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/submissions${queryString ? `?${queryString}` : ''}`);
}

export async function createSubmission(data: any): Promise<any> {
  return apiClient.post<any>('/api/submissions', data);
}

export async function updateSubmission(id: string, updates: any): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/submissions/${id}`, updates);
}

export async function deleteSubmission(id: string, operatorId?: string, reason?: string): Promise<{ success: boolean }> {
  const body = operatorId || reason ? { operatorId, reason } : undefined;
  return apiClient.delete<{ success: boolean }>(`/api/submissions/${id}`, body);
}

// ============================================
// 用户管理 API
// ============================================

export async function getUsers(role?: string, classId?: string, includeDeleted?: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  if (role) params.append('role', role);
  if (classId) params.append('classId', classId);
  if (includeDeleted) params.append('includeDeleted', 'true');
  const queryString = params.toString();
  return apiClient.get<any[]>(`/api/users${queryString ? `?${queryString}` : ''}`);
}

export async function createUser(data: any): Promise<any> {
  return apiClient.post<any>('/api/users', data);
}

export async function updateUser(id: string, updates: any): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/users/${id}`, updates);
}

export async function deleteUser(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/api/users/${id}`);
}

export async function blockUser(id: string): Promise<{ success: boolean }> {
  return apiClient.put<{ success: boolean }>(`/api/users/${id}/block`, {});
}

// ============================================
// 操作日志 API
// ============================================

export async function getOperationLogs(params?: { operatorId?: string; targetType?: string; targetId?: string; limit?: number }): Promise<any[]> {
  const searchParams = new URLSearchParams();
  if (params?.operatorId) searchParams.append('operatorId', params.operatorId);
  if (params?.targetType) searchParams.append('targetType', params.targetType);
  if (params?.targetId) searchParams.append('targetId', params.targetId);
  if (params?.limit) searchParams.append('limit', String(params.limit));
  const queryString = searchParams.toString();
  return apiClient.get<any[]>(`/api/logs${queryString ? `?${queryString}` : ''}`);
}

export async function createOperationLog(data: any): Promise<any> {
  return apiClient.post<any>('/api/logs', data);
}
// ============================================
// 数据清理 API (永久删除 R2 文件)
// ============================================

export async function permanentlyDeleteWithR2Cleanup(type: 'resource' | 'channel' | 'user' | 'question' | 'exam-paper' | 'classroom' | 'exam-session' | 'syllabus-course', id: string): Promise<{ success: boolean; message: string }> {
  return apiClient.post<{ success: boolean; message: string }>('/api/cleanup', { type, id });
}

// ============================================
// 恢复回收站记录 API
// ============================================

export async function restoreFromRecycleBin(type: 'resource' | 'channel' | 'user' | 'question' | 'exam-paper' | 'classroom' | 'exam-session' | 'syllabus-course', id: string): Promise<{ success: boolean; message: string }> {
  return apiClient.post<{ success: boolean; message: string }>('/api/restore', { type, id });
}