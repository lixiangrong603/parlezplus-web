
import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, BookOpen, Clock, BarChart3, MessageSquare, ClipboardCheck, ArrowRight, Star, UserPlus, UserMinus,
  FileVideo, AlertCircle, Eye, Calendar, Database,
  Settings, Lock, LogOut, Key, Globe, Sparkles, X, CheckCircle, ChevronLeft, Plus, Trash2, Sun, Moon, RotateCcw,
  Send, History, BookmarkPlus, MinusCircle, ChevronDown, ChevronUp, FileCheck, Edit2, Loader2, FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { Classroom, Student, Submission, MediaResource, User } from '../types';
import { 
  getClassrooms, saveClassroom, deleteClassroom, saveUser, getUsers, getUserById, getResources, saveResource
} from '../utils/storage';
import { MOCK_RESOURCES, CURRENT_USER_ID } from '../constants'; 
import { ResourceManagement } from './ResourceManagement';
import PracticeStudio from './PracticeStudio';
import { ThemeContext } from '../App';
import SubmissionManager from './SubmissionManager';
import QuestionBankDashboard from './QuestionBankDashboard';
import ExamCenterDashboard from './ExamCenterDashboard';

// --- SHARED MODAL COMPONENT ---
const CustomConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "确认", 
  cancelText = "取消",
  type = "danger" 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string, 
  confirmText?: string, 
  cancelText?: string,
  type?: "danger" | "info"
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border dark:border-slate-800">
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}>
            {type === 'danger' ? <Trash2 size={32} /> : <AlertCircle size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-[1.5] py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all active:scale-95 ${type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-100 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

// --- MOCK SUBMISSIONS ---
const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: 'sub-1',
    studentId: 's1',
    resourceId: 'resource-101',
    submittedAt: '10分钟前',
    audioUrl: '', 
    status: 'pending_review',
    aiScore: {
      overallScore: 82,
      correctness: 85,
      completeness: 90,
      fluency: 71,
      prosody: 75,
      generalFeedback: "整体发音清晰，但在 /y/ 和 /u/ 的区分上仍有进步空间。'C'était' 的连读非常自然。",
      words: []
    },
    quizResult: {
      score: 4,
      total: 5,
      answers: {}
    }
  }
];

interface TeacherDashboardProps {
  onBack: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onBack }) => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState<'classes' | 'resources' | 'bank' | 'exams'>('classes');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [previewResource, setPreviewResource] = useState<MediaResource | null>(null);
  const [gradingTaskId, setGradingTaskId] = useState<string | null>(null);

  if (previewResource) {
    return (
      <PracticeStudio 
        resource={previewResource} 
        onBack={() => setPreviewResource(null)} 
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans overflow-hidden transition-colors duration-300">
      <header className="h-16 bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm shrink-0 transition-colors">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer">
            <h1 className="text-xl font-black text-indigo-900 dark:text-indigo-400 tracking-tight">ParlezPlus</h1>
            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-indigo-200 dark:border-indigo-800">Teacher</span>
          </div>
          
          <nav className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button 
              onClick={() => { setActiveTab('classes'); setSelectedClassId(null); setGradingTaskId(null); }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'classes' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <Users size={16} /> 班级管理
            </button>
            <button 
              onClick={() => { setActiveTab('resources'); }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'resources' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <FileVideo size={16} /> 多媒体资源
            </button>
            <button 
              onClick={() => { setActiveTab('bank'); }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'bank' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <Database size={16} /> 题库中心
            </button>
            <button 
              onClick={() => { setActiveTab('exams'); }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'exams' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <FileSpreadsheet size={16} /> 组卷中心
            </button>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
           <button onClick={toggleTheme} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all active:scale-95">
             {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
           </button>
           <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{user?.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">高级法语讲师</p>
           </div>
           <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-full border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-400 p-0.5 transition-all active:scale-95 overflow-hidden">
             <img src={user?.avatar || "https://i.pravatar.cc/150?u=teacher"} className="w-full h-full rounded-full object-cover" />
           </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 relative">
        {activeTab === 'classes' ? (
          gradingTaskId ? (
            <SubmissionManager 
              taskId={gradingTaskId} 
              classId={selectedClassId!}
              onBack={() => setGradingTaskId(null)} 
            />
          ) : (
            <ClassManager 
              teacherId={user?.id || ''}
              selectedClassId={selectedClassId} 
              onSelectClass={setSelectedClassId} 
              onOpenGradingTask={(tid) => setGradingTaskId(tid)}
            />
          )
        ) : activeTab === 'resources' ? (
          <ResourceManagement onExit={() => setActiveTab('classes')} onPreview={(r) => setPreviewResource(r)} />
        ) : activeTab === 'exams' ? (
          <ExamCenterDashboard />
        ) : (
          <QuestionBankDashboard />
        )}
      </main>

      {showSettings && <TeacherSettingsModal onClose={() => setShowSettings(false)} onLogout={logout} />}
    </div>
  );
};

const ClassManager = ({ 
  teacherId,
  selectedClassId, 
  onSelectClass, 
  onOpenGradingTask
}: { 
  teacherId: string,
  selectedClassId: string | null, 
  onSelectClass: (id: string | null) => void,
  onOpenGradingTask: (taskId: string) => void
}) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, classId: string} | null>(null);

  useEffect(() => {
    setClassrooms(getClassrooms(teacherId));
  }, [teacherId]);

  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    const newClass: Classroom = { id: Date.now().toString(), userId: teacherId, name: newClassName, studentCount: 0, students: [] };
    saveClassroom(newClass);
    setClassrooms(getClassrooms(teacherId));
    setNewClassName('');
    setShowAddClass(false);
  };

  const handleDeleteClass = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmState({ isOpen: true, classId: id });
  };

  const executeDeleteClass = () => {
    if (!confirmState) return;
    const id = confirmState.classId;
    deleteClassroom(id);
    setClassrooms(getClassrooms(teacherId));
    if (selectedClassId === id) onSelectClass(null);
    setConfirmState(null);
  };

  if (!selectedClassId) {
    return (
      <div className="h-full overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-950/50 no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">我的班级</h2>
            <button onClick={() => setShowAddClass(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 transition">
              <Plus size={18} /> 新建班级
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map(cls => (
              <div key={cls.id} onClick={() => onSelectClass(cls.id)} className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Users size={24} />
                  </div>
                  <button onClick={(e) => handleDeleteClass(cls.id, e)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{cls.name}</h3>
                <div className="flex items-center gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">学生</p>
                    <p className="text-lg font-black text-slate-700 dark:text-slate-300">{cls.students.length}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {showAddClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl w-96 animate-fade-in-up border border-transparent dark:border-slate-800">
              <h3 className="text-lg font-bold mb-4 dark:text-slate-100">新建班级</h3>
              <input autoFocus className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-6 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" placeholder="例如：2024 春季口语提高班" value={newClassName} onChange={e => setNewClassName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddClass()} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddClass(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 text-sm font-bold">取消</button>
                <button onClick={handleAddClass} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md">立即创建</button>
              </div>
            </div>
          </div>
        )}
        <CustomConfirmModal 
          isOpen={!!confirmState} 
          onClose={() => setConfirmState(null)} 
          onConfirm={executeDeleteClass}
          title="删除班级"
          message="确定要删除这个班级吗？所有学生进度和作业关联将被清空，此操作不可恢复。"
        />
      </div>
    );
  }

  return (
    <ClassDetailView 
      classId={selectedClassId} 
      teacherId={teacherId}
      onBack={() => onSelectClass(null)} 
      onOpenGradingTask={onOpenGradingTask} 
    />
  );
};

const ClassDetailView = ({ 
  classId, 
  teacherId,
  onBack, 
  onOpenGradingTask
}: { 
  classId: string, 
  teacherId: string,
  onBack: () => void,
  onOpenGradingTask: (taskId: string) => void 
}) => {
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignedResources, setAssignedResources] = useState<MediaResource[]>([]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isRosterCollapsed, setIsRosterCollapsed] = useState(true);
  const [newStudentData, setNewStudentData] = useState({ name: '', username: '' });
  const [editingDeadlineResource, setEditingDeadlineResource] = useState<MediaResource | null>(null);
  const [newDeadline, setNewDeadline] = useState('');
  
  // 综合确认框状态
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean, 
    title: string, 
    message: string, 
    onConfirm: () => void,
    type?: "danger" | "info"
  } | null>(null);

  const loadData = () => {
    const cls = getClassrooms(teacherId).find(c => c.id === classId);
    if (cls) setClassroom(cls);
    const allResources = getResources();
    setAssignedResources(allResources.filter(r => r.assignedClassIds?.includes(classId)).sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(() => { loadData(); }, [classId, teacherId]);

  const handleAddStudent = () => {
    if (!newStudentData.name.trim() || !newStudentData.username.trim()) return;
    
    const existingUsers = getUsers();
    const existingUser = existingUsers.find(u => u.username === newStudentData.username.trim().toLowerCase());
    
    if (existingUser) {
        if (existingUser.classId === classId) {
            setConfirmConfig({
              isOpen: true,
              title: "提示",
              message: "该学生已在班级中。",
              onConfirm: () => {},
              type: "info"
            });
            return;
        }
        // 如果学生存在但不在班级中，更新班级 ID
        existingUser.classId = classId;
        saveUser(existingUser);
        
        const newStudent: Student = { 
            id: `s-${Date.now()}`, 
            userId: existingUser.id, 
            name: existingUser.name, 
            avatar: existingUser.avatar || `https://i.pravatar.cc/150?u=${existingUser.id}`, 
            overallProgress: 0 
        };
        const updatedClass = { ...classroom!, students: [...classroom!.students, newStudent], studentCount: classroom!.students.length + 1 };
        saveClassroom(updatedClass);
        setConfirmConfig({
          isOpen: true,
          title: "导入成功",
          message: `已找到现有账号 @${existingUser.username}，已将其加入班级。`,
          onConfirm: () => {},
          type: "info"
        });
    } else {
        const studentUserId = `u-${Date.now()}`;
        const newUser: User = { id: studentUserId, username: newStudentData.username.trim().toLowerCase(), password: '123456', name: newStudentData.name.trim(), role: 'student', isBlocked: false, classId: classId };
        saveUser(newUser);
        const newStudent: Student = { id: `s-${Date.now()}`, userId: studentUserId, name: newStudentData.name.trim(), avatar: `https://i.pravatar.cc/150?u=${studentUserId}`, overallProgress: 0 };
        const updatedClass = { ...classroom!, students: [...classroom!.students, newStudent], studentCount: classroom!.students.length + 1 };
        saveClassroom(updatedClass);
    }
    
    loadData();
    setNewStudentData({ name: '', username: '' });
    setShowAddStudent(false);
  };

  const handleResetPassword = (studentId: string) => {
    const student = classroom?.students.find(s => s.id === studentId);
    if (student && student.userId) {
        const user = getUserById(student.userId);
        if (user) {
            setConfirmConfig({
              isOpen: true,
              title: "重置密码",
              message: `确定要将学生 ${user.name} 的密码重置为默认值 (123456) 吗？`,
              onConfirm: () => {
                user.password = '123456';
                saveUser(user);
                setConfirmConfig({ isOpen: true, title: "完成", message: "密码已成功重置为 123456", onConfirm: () => {}, type: "info" });
              }
            });
        }
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "移除学生",
      message: "确定要从该班级移除该学生吗？该学生的作业提交记录仍将保留，但不再出现在此班级名册。",
      onConfirm: () => {
        const student = classroom?.students.find(s => s.id === studentId);
        if (student && student.userId) {
            const user = getUserById(student.userId);
            if (user) {
                user.classId = undefined;
                saveUser(user);
            }
        }
        const updatedClass = { ...classroom!, students: classroom!.students.filter(s => s.id !== studentId), studentCount: classroom!.students.length - 1 };
        saveClassroom(updatedClass);
        loadData();
      }
    });
  };

  const handleWithdrawTask = (resourceId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "撤回任务",
      message: "确定要从该班级撤回此任务吗？学生将无法再看到该任务。",
      onConfirm: () => {
        const resource = getResources().find(r => r.id === resourceId);
        if (resource) {
          const updated = { ...resource, assignedClassIds: (resource.assignedClassIds || []).filter(id => id !== classId) };
          saveResource(updated);
          loadData();
        }
      }
    });
  };

  const handleUpdateDeadline = () => {
    if (editingDeadlineResource) {
      const updated = { ...editingDeadlineResource, deadline: newDeadline ? new Date(newDeadline).getTime() : undefined };
      saveResource(updated);
      loadData();
      setEditingDeadlineResource(null);
    }
  };

  if (!classroom) return null;

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-950/50 no-scrollbar pb-20">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition shadow-sm border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{classroom.name}</h2>
        </div>

        {/* Top: Student Roster (Collapsible) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-all">
          <div className="p-5 flex justify-between items-center border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <button onClick={() => setIsRosterCollapsed(!isRosterCollapsed)} className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 transition-colors">
                <Users size={20} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  学生名册 ({classroom.students.length})
                  {isRosterCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                </h3>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Manage class members</p>
              </div>
            </button>
            <div className="flex gap-2">
                <button 
                  onClick={() => setShowBatchImport(true)} 
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm text-xs font-bold"
                >
                  <FileSpreadsheet size={16} /> 批量导入
                </button>
                <button onClick={() => setShowAddStudent(true)} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md">
                  <UserPlus size={18} />
                </button>
            </div>
          </div>
          {!isRosterCollapsed && (
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[400px] overflow-y-auto no-scrollbar animate-fade-in-down">
              {classroom.students.length === 0 ? (
                <p className="col-span-full text-center text-xs text-slate-400 py-4 italic">班级暂无学生</p>
              ) : (
                classroom.students.map(student => (
                  <div key={student.id} className="flex flex-col items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 relative group transition-all hover:shadow-md">
                    <img src={student.avatar} className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow-sm" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-full text-center">{student.name}</span>
                    
                    <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleResetPassword(student.id)} 
                            className="p-1.5 bg-white dark:bg-slate-700 rounded-lg text-slate-400 hover:text-amber-500 shadow-sm transition-colors border dark:border-slate-600"
                            title="重置密码"
                        >
                            <RotateCcw size={12} />
                        </button>
                        <button 
                            onClick={() => handleRemoveStudent(student.id)} 
                            className="p-1.5 bg-white dark:bg-slate-700 rounded-lg text-slate-400 hover:text-red-500 shadow-sm transition-colors border dark:border-slate-600"
                            title="移出班级"
                        >
                            <UserMinus size={12} />
                        </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Middle: Task List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History size={18} className="text-indigo-600" /> 已分发任务
            </h2>
            <button onClick={() => setShowAddTask(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition">
              <BookmarkPlus size={14} /> 分发新任务
            </button>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-colors">
            {assignedResources.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Send size={48} className="mb-2 opacity-10" />
                <p className="text-sm font-bold">班级暂无分发任务</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="w-[40%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">任务内容</th>
                    <th className="w-[20%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">完成进度</th>
                    <th className="w-[20%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">截止日期</th>
                    <th className="w-[20%] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {assignedResources.map(res => {
                    const submitted = MOCK_SUBMISSIONS.filter(s => s.resourceId === res.id).length;
                    const total = classroom.students.length;
                    return (
                      <tr key={res.id} className="group hover:bg-indigo-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={res.coverImage} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{res.title}</p>
                              <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded font-bold">{res.level}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">{submitted}/{total}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            <button onClick={() => { setEditingDeadlineResource(res); setNewDeadline(res.deadline ? new Date(res.deadline).toISOString().split('T')[0] : ''); }} className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 group/date transition-colors">
                                <Clock size={12} className={res.deadline && Date.now() > res.deadline ? "text-red-500" : ""} />
                                <span className={res.deadline && Date.now() > res.deadline ? "text-red-500 font-bold" : ""}>
                                {res.deadline ? new Date(res.deadline).toLocaleDateString() : '无限制'}
                                </span>
                                <Edit2 size={10} className="opacity-0 group-hover/date:opacity-100 transition-opacity" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => onOpenGradingTask(res.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                              <FileCheck size={14} /> 批改
                            </button>
                            <button onClick={() => handleWithdrawTask(res.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><MinusCircle size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Deadlines Update Modal */}
      {editingDeadlineResource && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl w-80 animate-fade-in-up border dark:border-slate-800">
            <h3 className="text-lg font-bold mb-4 dark:text-slate-100">修改截止日期</h3>
            <input type="date" className="w-full p-2.5 border rounded-xl mb-6 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingDeadlineResource(null)} className="px-4 py-2 text-slate-500 text-sm font-bold">取消</button>
              <button onClick={() => { setNewDeadline(''); }} className="px-4 py-2 text-red-500 text-sm font-bold hover:bg-red-50 rounded-xl">清除日期</button>
              <button onClick={handleUpdateDeadline} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Import Modal */}
      {showBatchImport && (
          <BatchImportModal 
            onClose={() => setShowBatchImport(false)}
            onImport={(list) => {
                const existingUsers = getUsers();
                let addedCount = 0;
                let createdCount = 0;
                let skipCount = 0;

                const newStudents: Student[] = [...classroom.students];

                list.forEach(item => {
                    const username = item.username.trim().toLowerCase();
                    const name = item.name.trim();
                    if (!username || !name) return;

                    // 检查是否已经在当前班级
                    if (newStudents.some(s => s.userId && getUserById(s.userId)?.username === username)) {
                        skipCount++;
                        return;
                    }

                    const existingUser = existingUsers.find(u => u.username === username);
                    if (existingUser) {
                        // 账号存在，关联班级
                        existingUser.classId = classId;
                        saveUser(existingUser);
                        newStudents.push({
                            id: `s-${Date.now()}-${username}`,
                            userId: existingUser.id,
                            name: existingUser.name,
                            avatar: existingUser.avatar || `https://i.pravatar.cc/150?u=${existingUser.id}`,
                            overallProgress: 0
                        });
                        addedCount++;
                    } else {
                        // 账号不存在，新建
                        const studentUserId = `u-${Date.now()}-${username}`;
                        const newUser: User = { 
                            id: studentUserId, username, password: '123456', 
                            name, role: 'student', isBlocked: false, classId: classId 
                        };
                        saveUser(newUser);
                        newStudents.push({
                            id: `s-${Date.now()}-${username}`,
                            userId: studentUserId,
                            name: newUser.name,
                            avatar: `https://i.pravatar.cc/150?u=${studentUserId}`,
                            overallProgress: 0
                        });
                        createdCount++;
                    }
                });

                const updatedClass = { ...classroom, students: newStudents, studentCount: newStudents.length };
                saveClassroom(updatedClass);
                loadData();
                setConfirmConfig({
                  isOpen: true,
                  title: "导入完成",
                  message: `导入操作已结束。\n新增关联: ${addedCount} 人\n新开账号: ${createdCount} 人\n跳过(已在班级): ${skipCount} 人`,
                  onConfirm: () => {},
                  type: "info"
                });
                setShowBatchImport(false);
            }}
          />
      )}

      {/* Custom Confirm Modal */}
      <CustomConfirmModal 
        isOpen={!!confirmConfig && confirmConfig.isOpen}
        onClose={() => setConfirmConfig(null)}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        title={confirmConfig?.title || ""}
        message={confirmConfig?.message || ""}
        type={confirmConfig?.type}
      />

      {/* Other Modals (Add Student, Add Task) */}
      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onAssign={(rid, d) => {
        const resource = getResources().find(r => r.id === rid);
        if(resource) saveResource({ ...resource, status: 'ready', deadline: d, assignedClassIds: [...(resource.assignedClassIds || []), classId] });
        loadData(); setShowAddTask(false);
      }} alreadyAssignedIds={assignedResources.map(r => r.id)} />}
      
      {showAddStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-sm border dark:border-slate-800">
            <h3 className="text-xl font-black mb-6 dark:text-slate-100">添加学生</h3>
            <div className="space-y-4">
              <input className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 dark:text-white" placeholder="真实姓名" value={newStudentData.name} onChange={e => setNewStudentData({ ...newStudentData, name: e.target.value })} />
              <input className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 dark:text-white" placeholder="用户名" value={newStudentData.username} onChange={e => setNewStudentData({ ...newStudentData, username: e.target.value.replace(/\s+/g, '') })} />
            </div>
            <div className="flex gap-2 justify-end mt-8">
              <button onClick={() => setShowAddStudent(false)} className="px-6 py-2.5 text-slate-500 text-sm font-bold">取消</button>
              <button onClick={handleAddStudent} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-100">确认添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BatchImportModal = ({ onClose, onImport }: { onClose: () => void, onImport: (list: {name: string, username: string}[]) => void }) => {
    const [input, setInput] = useState('');
    
    const handleProcess = () => {
        const lines = input.split('\n').filter(l => l.trim().length > 0);
        const list: {name: string, username: string}[] = [];
        lines.forEach(line => {
            // 支持 逗号、制表符、空格 分隔
            const parts = line.split(/[,\t\s]+/).filter(p => p.trim().length > 0);
            if (parts.length >= 2) {
                list.push({ name: parts[0], username: parts[1] });
            }
        });
        if (list.length === 0) {
            return; // 这里应该用自定义弹窗通知，但最小化更新只处理 confirm
        }
        onImport(list);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-800">
                <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">批量导入学生</h3>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-bold">Paste from Excel or Table</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-400"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold mb-2">输入格式要求：</p>
                        <ul className="text-[10px] text-indigo-600 dark:text-indigo-400 space-y-1">
                            <li>• 每行一个学生，格式为：<span className="font-mono bg-white dark:bg-slate-800 px-1 rounded">姓名 用户名</span></li>
                            <li>• 分隔符支持空格、Tab或逗号</li>
                            <li>• 示例：<span className="italic">张三 zhangsan123</span></li>
                        </ul>
                    </div>
                    <textarea 
                        autoFocus
                        className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                        placeholder="在此粘贴名单数据..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                    />
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500">取消</button>
                    <button onClick={handleProcess} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg hover:bg-indigo-700 transition">开始分析并导入</button>
                </div>
            </div>
        </div>
    );
};

const AddTaskModal = ({ onClose, onAssign, alreadyAssignedIds }: { onClose: () => void, onAssign: (id: string, deadline?: number) => void, alreadyAssignedIds: string[] }) => {
    const resources = getResources().filter(r => !alreadyAssignedIds.includes(r.id));
    const [selectedDeadline, setSelectedDeadline] = useState<string>('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden animate-fade-in-up border dark:border-slate-800">
                <div className="p-8 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">分发新任务</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition text-slate-400"><X size={20} /></button>
                </div>
                <div className="p-8 bg-indigo-50/30 border-b border-indigo-100 shrink-0">
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">任务截止时间 (可选)</label>
                    <input type="date" className="w-full bg-white border border-indigo-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white" value={selectedDeadline} onChange={e => setSelectedDeadline(e.target.value)} />
                </div>
                <div className="p-6 overflow-y-auto no-scrollbar flex-1 space-y-4">
                    {resources.length === 0 ? <p className="py-12 text-center text-slate-400 italic">没有可分发的资源</p> : resources.map(res => (
                        <div key={res.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-indigo-50 group">
                             <div className="flex items-center gap-4">
                                 <img src={res.coverImage} className="w-14 h-14 rounded-xl object-cover" />
                                 <p className="font-bold text-slate-800 dark:text-slate-100">{res.title}</p>
                             </div>
                             <button onClick={() => onAssign(res.id, selectedDeadline ? new Date(selectedDeadline).getTime() : undefined)} className="px-5 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl opacity-0 group-hover:opacity-100 shadow-md">分发</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TeacherSettingsModal = ({ onClose, onLogout }: { onClose: () => void, onLogout: () => void }) => {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
  const [azureKey, setAzureKey] = useState(localStorage.getItem(`${CURRENT_USER_ID}_azure_speech_key`) || '');
  const [azureRegion, setAzureRegion] = useState(localStorage.getItem(`${CURRENT_USER_ID}_azure_speech_region`) || 'westeurope');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem(`${CURRENT_USER_ID}_gemini_api_key`) || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      localStorage.setItem(`${CURRENT_USER_ID}_azure_speech_key`, azureKey);
      localStorage.setItem(`${CURRENT_USER_ID}_azure_speech_region`, azureRegion);
      localStorage.setItem(`${CURRENT_USER_ID}_gemini_api_key`, geminiKey);
      setIsSaving(false); onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex h-[500px] border dark:border-slate-800">
        <div className="w-48 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-100 dark:border-slate-800 flex flex-col p-4 shrink-0">
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('general')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${activeTab === 'general' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200/50'}`}><Settings size={18} /> 通用配置</button>
            <button onClick={() => setActiveTab('security')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${activeTab === 'security' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200/50'}`}><Lock size={18} /> 安全设置</button>
          </nav>
          <button onClick={onLogout} className="mt-auto w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50"><LogOut size={18} /> 退出登录</button>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center"><h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{activeTab === 'general' ? 'API 与服务配置' : '安全与密码'}</h2><button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-400"><X size={20} /></button></div>
          <div className="p-8 flex-1 overflow-y-auto no-scrollbar">
            {activeTab === 'general' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-bold dark:text-slate-100">暗夜模式</span>
                  <button onClick={toggleTheme} className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} /></button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Azure Key</label><input type="password" value={azureKey} onChange={e => setAzureKey(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-sm" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Azure Region</label><input type="text" value={azureRegion} onChange={e => setAzureRegion(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-sm" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Gemini Key</label><input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-sm" /></div>
                </div>
              </div>
            ) : <div className="p-4 text-center text-slate-400 italic">密码修改功能暂未开放</div>}
          </div>
          <div className="p-6 border-t dark:border-slate-800 flex justify-end gap-3 shrink-0"><button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500">取消</button><button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">{isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={18} />} 保存配置</button></div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
