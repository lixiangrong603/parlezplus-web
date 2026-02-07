
import React, { useState, useEffect, createContext, useContext } from 'react';
import { MediaResource } from './types';
import { TeacherDashboard } from './components/TeacherDashboard'; 
import { JobProvider } from './contexts/JobContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './components/AdminDashboard';
import StudentDashboard from './components/StudentDashboard';
import PracticeStudio from './components/PracticeStudio';
import { getResources } from './utils/storage';
import { ModalProvider, useModal } from './contexts/ModalContext';

// Theme Context
interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}
export const ThemeContext = createContext<ThemeContextType>({ isDarkMode: false, toggleTheme: () => {} });

function AppContent() {
  const { user, isLoading } = useAuth();
  const { isDarkMode } = useContext(ThemeContext);
  const modal = useModal();
  const [selectedResource, setSelectedResource] = useState<MediaResource | null>(null);
  const [resources, setResources] = useState<MediaResource[]>([]);

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