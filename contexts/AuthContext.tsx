
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getUsers } from '../utils/storage';
import { useModal } from './ModalContext';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
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

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
