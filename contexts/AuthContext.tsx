
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '../types';
import { login as apiLogin, getCurrentUser, logout as apiLogout, apiClient } from '../services/api/client';
import { useModal } from './ModalContext';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  updateUser: (updatedUser: User) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// [FIX] 使用 React.FC 并明确定义 children 属性，解决 TSX 中使用该组件时提示 children 缺失的编译错误
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const modal = useModal();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 同步 API Keys 从数据库到 localStorage（跨浏览器支持）
  const syncApiKeys = useCallback(async (userId: string) => {
    try {
      // 检查 localStorage 中是否已有 key
      const localAzureKey = localStorage.getItem(`${userId}_azure_speech_key`);
      const localGeminiKey = localStorage.getItem(`${userId}_gemini_api_key`);
      
      // 如果 localStorage 已有 key，无需同步
      if (localAzureKey && localGeminiKey) return;
      
      // 从数据库获取解密后的 key
      const data = await apiClient.get<{
        hasGeminiKey: boolean;
        hasAzureKey: boolean;
        azureRegion: string;
        geminiKey?: string;
        azureKey?: string;
      }>(`/api/users/${userId}/api-keys?decrypt=true`);
      
      // 同步到 localStorage
      if (data.azureKey && !localAzureKey) {
        localStorage.setItem(`${userId}_azure_speech_key`, data.azureKey);
      }
      if (data.geminiKey && !localGeminiKey) {
        localStorage.setItem(`${userId}_gemini_api_key`, data.geminiKey);
      }
      if (data.azureRegion) {
        localStorage.setItem(`${userId}_azure_speech_region`, data.azureRegion);
      }
    } catch (error) {
      // 静默失败，不影响用户体验
      console.warn('Failed to sync API keys:', error);
    }
  }, []);

  useEffect(() => {
    // 尝试从 API 恢复会话
    const token = localStorage.getItem('auth_token');
    if (token) {
      // [FIX] 在开发环境下添加超时处理，避免 API 调用卡住
      const timeoutId = setTimeout(() => {
        console.warn('Session restore timeout, clearing token');
        localStorage.removeItem('auth_token');
        setIsLoading(false);
      }, 3000); // 3秒超时

      getCurrentUser()
        .then(currentUser => {
          clearTimeout(timeoutId);
          setUser(currentUser);
          // 登录后同步 API Keys 到 localStorage
          syncApiKeys(currentUser.id);
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.error('Failed to restore session:', err);
          // Token 无效，清除
          localStorage.removeItem('auth_token');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [syncApiKeys]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const { user: loggedInUser } = await apiLogin(username, password);
      
      if (loggedInUser.is_blocked === 1) {
        await modal.alert({ message: '账号已被锁定，请联系管理员。' });
        return false;
      }
      
      setUser(loggedInUser);
      // 登录后同步 API Keys 到 localStorage
      syncApiKeys(loggedInUser.id);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    apiLogout(); // 清除 API client 中的 token
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: '用户未登录' };
    }

    // 验证新密码
    if (newPassword.length < 6) {
      return { success: false, message: '新密码至少需要6个字符' };
    }

    if (newPassword === oldPassword) {
      return { success: false, message: '新密码不能与原密码相同' };
    }

    try {
      // 调用后端 API 修改密码，并设置 needsPasswordChange: false
      const response = await fetch(`/api/users/${user.id}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          oldPassword,
          newPassword,
          needsPasswordChange: false, // 用户自己修改密码后不再需要强制修改
        }),
      });

      const result = await response.json() as { data?: { success: boolean; message: string }; error?: string };

      if (!response.ok) {
        return { success: false, message: result.error || '修改密码失败' };
      }

      return { success: true, message: result.data?.message || '密码修改成功' };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, message: '网络错误，请稍后重试' };
    }
  };

  const updateUser = (updatedUser: User) => {
    // TODO: 实现 /api/users/{id} PUT 端点
    // 临时：仅更新本地状态
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
