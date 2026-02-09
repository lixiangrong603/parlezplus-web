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

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
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

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const result = await apiClient.post<{ token: string; user: User }>('/api/auth', {
    username,
    password,
  });
  
  apiClient.setToken(result.token);
  return result;
}

export async function getCurrentUser(): Promise<User> {
  return apiClient.get<User>('/api/auth');
}

export function logout() {
  apiClient.clearToken();
}

// ============================================
// 资源 API
// ============================================

export async function getResources(teacherId?: string): Promise<any[]> {
  const queryParam = teacherId ? `?teacherId=${teacherId}` : '';
  return apiClient.get<any[]>(`/api/resources${queryParam}`);
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
