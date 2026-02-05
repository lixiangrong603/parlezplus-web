
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Sparkles, AlertCircle, Zap } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const success = await login(username, password);
    if (!success) {
      setError('用户名或密码错误，或账号已被禁用');
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (roleUser: string) => {
    setIsSubmitting(true);
    // 适配新的默认密码 123456
    const pwd = (roleUser === 'admin') ? 'admin123' : 
                (roleUser === 'teacher') ? 'teacher123' : 
                (roleUser === 'student') ? 'student123' : '123456';
    await login(roleUser, pwd);
    setIsSubmitting(false);
  };

  return (
    <div className="h-screen w-screen bg-indigo-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0,100 C20,80 50,0 100,0 L100,100 Z" fill="#4f46e5" />
        </svg>
      </div>

      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 z-10 animate-fade-in-up border border-transparent dark:border-slate-800 transition-colors">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-100 dark:shadow-none">
            <Sparkles size={32} />
          </div>
          <h1 className="text-3xl font-black text-indigo-900 dark:text-indigo-400 tracking-tight">ParlezPlus</h1>
          </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">用户名</label>
            <input 
              type="text" 
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="admin / teacher / student"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">密码</label>
            <input 
              type="password" 
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="默认密码: 123456"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-xs font-bold animate-pulse border border-red-100 dark:border-red-900/30">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSubmitting ? '登录中...' : <><LogIn size={20} /> 进入系统</>}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800 text-center">
          <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-bold mb-4">
             <Zap size={14} className="text-amber-400 fill-amber-400" />
             <span>开发环境极速通道</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
             <button onClick={() => handleQuickLogin('admin')} className="py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition border border-transparent dark:border-slate-700">
                管理员
             </button>
             <button onClick={() => handleQuickLogin('teacher')} className="py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition border border-transparent dark:border-slate-700">
                教师
             </button>
             <button onClick={() => handleQuickLogin('student')} className="py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition border border-transparent dark:border-slate-700">
                学生
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
