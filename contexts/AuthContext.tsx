
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { login as apiLogin, getCurrentUser, logout as apiLogout } from '../services/api/client';
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
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const { user: loggedInUser } = await apiLogin(username, password);
      
      if (loggedInUser.is_blocked === 1) {
        await modal.alert({ message: '账号已被锁定，请联系管理员。' });
        return false;
      }
      
      setUser(loggedInUser);
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
    // TODO: 实现 /api/users/{id}/password API 端点
    // 当前为临时实现，不验证旧密码，仅做客户端检查
    
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

    // TODO: 调用 API 修改密码
    // await apiClient.put(`/api/users/${user.id}/password`, { oldPassword, newPassword });
    
    // 临时：仅在客户端标记密码已更改
    console.warn('Password change not implemented on backend. Use localStorage fallback.');
    
    return { success: true, message: '密码修改成功（临时实现）' };
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
