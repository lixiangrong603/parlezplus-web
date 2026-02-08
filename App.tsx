
import React, { useState, useEffect, createContext, useContext } from 'react';
import { MediaResource } from './types';
import { TeacherDashboard } from './components/TeacherDashboard'; 
import { JobProvider } from './contexts/JobContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './components/AdminDashboard';
import StudentDashboard from './components/StudentDashboard';
import PracticeStudio from './components/PracticeStudio';
import { getResources, initializeAutomaticCleanup } from './utils/storage';
import { cleanAllAvatars } from './utils/cleanAvatars';
import { ModalProvider, useModal } from './contexts/ModalContext';
import { ChangePasswordModal } from './components/ChangePasswordModal';

// Theme Context
interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}
export const ThemeContext = createContext<ThemeContextType>({ isDarkMode: false, toggleTheme: () => {} });

function AppContent() {
  const { user, isLoading, updateUser } = useAuth();
  const { isDarkMode } = useContext(ThemeContext);
  const modal = useModal();
  const [selectedResource, setSelectedResource] = useState<MediaResource | null>(null);
  const [resources, setResources] = useState<MediaResource[]>([]);

  // 清理旧的头像数据（只在首次加载时运行一次）
  useEffect(() => {
    const hasCleanedAvatars = localStorage.getItem('parlezplus_avatars_cleaned');
    if (!hasCleanedAvatars) {
      const result = cleanAllAvatars();
      console.log(`🧹 首次启动清理：删除了 ${result.users} 个用户头像和 ${result.students} 个学生头像`);
      localStorage.setItem('parlezplus_avatars_cleaned', 'true');
    }
  }, []);

  // Apply theme class to HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Reload resources whenever user role is resolved or we return to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      // 教师只加载自己的资源，学生加载全部（以便在子组件中根据班级过滤）
      const fetchId = user.role === 'teacher' ? user.id : undefined;
      setResources(getResources(fetchId));
    }
  }, [isLoading, user, selectedResource]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-indigo-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // 首次登录强制修改密码
  if (user.needsPasswordChange) {
    return (
      <div className={`h-screen w-screen ${isDarkMode ? 'dark' : ''}`}>
        <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <ChangePasswordModal
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {
              const updatedUser = { ...user, needsPasswordChange: false };
              updateUser(updatedUser);
            }}
            isForced={true}
          />
        </div>
      </div>
    );
  }

  // Admin View
  if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  // Teacher View
  if (user.role === 'teacher') {
    return (
      <JobProvider>
        <TeacherDashboard onBack={() => {}} />
      </JobProvider>
    );
  }

  // Student View
  return (
    <JobProvider>
      {!selectedResource ? (
        <StudentDashboard 
          resources={resources} 
          onSelectResource={(resource) => setSelectedResource(resource)} 
          onEnterTeacherMode={() => modal.alert({ message: "您的账号暂无教师权限" })}
        />
      ) : (
        <PracticeStudio 
          resource={selectedResource} 
          onBack={() => setSelectedResource(null)} 
        />
      )}
    </JobProvider>
  );
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    initializeAutomaticCleanup();
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      localStorage.setItem('theme', newVal ? 'dark' : 'light');
      return newVal;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <ModalProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ModalProvider>
    </ThemeContext.Provider>
  );
}