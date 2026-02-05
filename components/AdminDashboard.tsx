
import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, UserPlus, Trash2, ShieldAlert, ShieldCheck, 
  Search, Filter, LogOut, Plus, X, Check, MoreVertical, Sun, Moon
} from 'lucide-react';
import { User, UserRole } from '../types';
import { getUsers, saveUser, deleteUser, toggleBlockUser } from '../utils/storage';
import { ThemeContext } from '../App';

export const AdminDashboard: React.FC = () => {
  const { user: currentUser, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', name: '', role: 'student' as UserRole });

  useEffect(() => {
    setUsers(getUsers());
  }, []);

  const handleAddUser = () => {
    if (!newUser.username || !newUser.name) return;
    const user: User = {
      id: `u-${Date.now()}`,
      username: newUser.username.toLowerCase(),
      name: newUser.name,
      role: newUser.role,
      isBlocked: false
    };
    saveUser(user);
    setUsers(getUsers());
    setShowAddModal(false);
    setNewUser({ username: '', name: '', role: 'student' });
  };

  const handleDelete = (id: string) => {
    if (id === currentUser?.id) return alert("不能删除当前登录账号");
    if (confirm('确定要彻底删除该用户及其所有关联数据吗？')) {
      deleteUser(id);
      setUsers(getUsers());
    }
  };

  const handleToggleBlock = (id: string) => {
    if (id === currentUser?.id) return alert("不能锁定当前登录账号");
    toggleBlockUser(id);
    setUsers(getUsers());
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans overflow-hidden transition-colors duration-300">
      <header className="h-16 bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-8 flex items-center justify-between shadow-sm shrink-0 transition-colors">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-indigo-900 dark:text-indigo-400 tracking-tight">ParlezPlus</h1>
          <span className="bg-indigo-900 dark:bg-indigo-950 text-white dark:text-indigo-300 px-3 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border dark:border-indigo-900">Admin</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
             onClick={toggleTheme}
             className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all active:scale-95"
             title={isDarkMode ? "切换到浅色模式" : "切换到深色模式"}
           >
             {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
           </button>

          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{currentUser?.name}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">超级管理员</p>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 transition-all"
          >
            <LogOut size={16} /> 退出登录
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">用户管理中心</h2>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">管理系统内所有的教师、学生及管理员账号权限</p>
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition"
            >
              <UserPlus size={18} /> 新增用户
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b dark:border-slate-800 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" size={18} />
                <input 
                  type="text" 
                  placeholder="搜索姓名、用户名或 ID..."
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-sm">
                <Filter size={18} />
              </button>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-950/50">
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">基本信息</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">身份角色</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">账号状态</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-lg">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{u.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 tracking-tight">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300' :
                        u.role === 'teacher' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300' :
                        'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {u.isBlocked ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">
                            <ShieldAlert size={14} /> 已锁定
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full">
                            <ShieldCheck size={14} /> 正常运行
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleToggleBlock(u.id)}
                          className={`p-2 rounded-xl transition-all ${u.isBlocked ? 'text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-orange-400 dark:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                          title={u.isBlocked ? "解锁" : "锁定"}
                        >
                          {u.isBlocked ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                        </button>
                        <button 
                          onClick={() => handleDelete(u.id)}
                          className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                          title="彻底删除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-900/20 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md animate-fade-in-up border border-transparent dark:border-slate-800">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">新增系统用户</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-400 dark:text-slate-500">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">用户名 (登录标识)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                  placeholder="请输入用户名"
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">真实姓名</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                  placeholder="请输入姓名"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">身份角色</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['student', 'teacher', 'admin'] as UserRole[]).map(role => (
                    <button
                      key={role}
                      onClick={() => setNewUser({...newUser, role})}
                      className={`py-3 rounded-2xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        newUser.role === role ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                      }`}
                    >
                      {role === 'student' ? '学生' : role === 'teacher' ? '教师' : '管理员'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-slate-500 dark:text-slate-400 text-sm font-bold bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">取消</button>
                <button 
                  onClick={handleAddUser}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700"
                >
                  确认创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};