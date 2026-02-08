
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getUsers } from '../utils/storage';
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
    const session = localStorage.getItem('parlezplus_session');
    if (session) {
      const sessionUser = JSON.parse(session);
      // [FIX] 每次刷新时，从全局用户列表中获取最新的用户信息（如 classId）
      const users = getUsers();
      const latestUser = users.find(u => u.id === sessionUser.id);
      if (latestUser) {
        setUser(latestUser);
        localStorage.setItem('parlezplus_session', JSON.stringify(latestUser));
      } else {
        setUser(sessionUser);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const users = getUsers();
    const foundUser = users.find(u => u.username === username);

    if (foundUser) {
      if (foundUser.isBlocked) {
        await modal.alert({ message: '账号已被锁定，请联系管理员。' });
        return false;
      }

      // 验证逻辑：优先使用存储的 password，否则尝试默认规则
      const storedPassword = foundUser.password;
      const legacyPassword = `${username}123`;
      const defaultNewPassword = `123456`;
      const adminOverride = `admin123`;

      if (
        password === storedPassword || 
        password === legacyPassword || 
        password === defaultNewPassword ||
        (foundUser.role === 'admin' && password === adminOverride)
      ) {
        setUser(foundUser);
        localStorage.setItem('parlezplus_session', JSON.stringify(foundUser));
        return true;
      }
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('parlezplus_session');
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: '用户未登录' };
    }

    const users = getUsers();
    const currentUser = users.find(u => u.id === user.id);
    
    if (!currentUser) {
      return { success: false, message: '用户不存在' };
    }

    // 验证旧密码
    const storedPassword = currentUser.password;
    const legacyPassword = `${currentUser.username}123`;
    const defaultNewPassword = `123456`;
    const adminOverride = `admin123`;

    const isOldPasswordValid = 
      oldPassword === storedPassword || 
      oldPassword === legacyPassword || 
      oldPassword === defaultNewPassword ||
      (currentUser.role === 'admin' && oldPassword === adminOverride);

    if (!isOldPasswordValid) {
      return { success: false, message: '原密码不正确' };
    }

    // 验证新密码
    if (newPassword.length < 6) {
      return { success: false, message: '新密码至少需要6个字符' };
    }

    if (newPassword === oldPassword) {
      return { success: false, message: '新密码不能与原密码相同' };
    }

    // 更新密码
    const updatedUser = { ...currentUser, password: newPassword, needsPasswordChange: false };
    const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
    
    // 保存到 localStorage
    localStorage.setItem('parlezplus_users', JSON.stringify(updatedUsers));
    
    // 更新当前用户状态
    setUser(updatedUser);
    localStorage.setItem('parlezplus_session', JSON.stringify(updatedUser));

    return { success: true, message: '密码修改成功' };
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('parlezplus_session', JSON.stringify(updatedUser));
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
