
import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, BookOpen, Clock, BarChart3, MessageSquare, ClipboardCheck, ArrowRight, Star, UserPlus, UserMinus,
  FileVideo, AlertCircle, Eye, Calendar, Database,
  Settings, Lock, LogOut, Key, Globe, Sparkles, X, CheckCircle, ChevronLeft, Plus, Trash2, Sun, Moon, RotateCcw,
  Send, History, BookmarkPlus, MinusCircle, ChevronDown, ChevronUp, FileCheck, Edit2, Loader2, FileSpreadsheet,
  AlertTriangle, Upload, Camera
} from 'lucide-react';
import AvatarEditor from './AvatarEditor';
import { Classroom, Student, Submission, MediaResource, User as UserType, ExamPaper, ExamSession } from '../types';
import { 
  getClassrooms, saveClassroom, saveUser, getUsers, getUserById, 
  getResources, getResourceById, saveResource, getExamPapers, updateExamPaper, getExamSessionsByExamAndClass,
  checkClassroomReferences, cascadeDeleteClassroom, ReferenceInfo
} from '../utils/storage';
import { apiClient } from '../services/api/client';
import { ResourceManagement } from './ResourceManagement';
import PracticeStudio from './PracticeStudio';
import { ThemeContext } from '../App';
import SubmissionManager from './SubmissionManager';
import QuestionBankDashboard from './QuestionBankDashboard';
import ExamCenterDashboard from './ExamCenterDashboard';
import { ClassSidebar } from './ClassSidebar';
import { StudentRoster } from './StudentRoster';
import ExamGradingManager from './ExamGradingManager';
import RecycleBinViewer from './RecycleBinViewer';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ChangePasswordForm } from './ChangePasswordForm';
import { getInitials, getColorFromString, compressImage, validateImageFile } from '../utils/mediaUtils';

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
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}>
            {type === 'danger' ? <Trash2 size={32} /> : <AlertCircle size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
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
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [previewResource, setPreviewResource] = useState<MediaResource | null>(null);
  const [gradingTaskId, setGradingTaskId] = useState<string | null>(null);
  const [gradingExam, setGradingExam] = useState<{ examId: string; classId: string } | null>(null);

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
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm shrink-0 transition-colors">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer">
            <h1 className="text-xl font-black text-indigo-900 dark:text-indigo-400 tracking-tight">Fluide</h1>
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
           <button 
             onClick={() => setShowRecycleBin(true)} 
             className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all active:scale-95"
             title="回收站"
           >
             <Trash2 size={20} />
           </button>
           <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{user?.name}</p>
           </div>
           <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-full border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-400 p-0.5 transition-all active:scale-95 overflow-hidden">
             {user?.avatar ? (
               <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
             ) : (
               <div 
                 className="w-full h-full rounded-full flex items-center justify-center text-white text-sm font-black"
                 style={{ backgroundColor: getColorFromString(user?.id || user?.name || '') }}
               >
                 {getInitials(user?.name || '')}
               </div>
             )}
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
          ) : gradingExam ? (
            <ExamGradingManager
              examId={gradingExam.examId}
              classId={gradingExam.classId}
              onBack={() => setGradingExam(null)}
            />
          ) : (
            <ClassManager 
              teacherId={user?.id || ''}
              selectedClassId={selectedClassId} 
              onSelectClass={setSelectedClassId} 
              onOpenGradingTask={(tid) => setGradingTaskId(tid)}
              onOpenGradingExam={(examId, classId) => setGradingExam({ examId, classId })}
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
      {showRecycleBin && (
        <RecycleBinViewer
          onClose={() => setShowRecycleBin(false)}
          teacherId={user?.id}
        />
      )}
    </div>
  );
};

const ClassManager = ({ 
  teacherId,
  selectedClassId, 
  onSelectClass, 
  onOpenGradingTask,
  onOpenGradingExam
}: { 
  teacherId: string,
  selectedClassId: string | null, 
  onSelectClass: (id: string | null) => void,
  onOpenGradingTask: (taskId: string) => void,
  onOpenGradingExam: (examId: string, classId: string) => void
}) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [confirmState, setConfirmState] = useState<{
    classId: string;
    className: string;
    references: ReferenceInfo[];
  } | null>(null);

  const loadClassrooms = async () => {
    const classes = await getClassrooms(teacherId);
    classes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setClassrooms(classes);
    // Default to first class if none selected
    if (classes.length > 0 && !selectedClassId) {
      onSelectClass(classes[0].id);
    }
  };

  useEffect(() => {
    loadClassrooms();
  }, [teacherId]);

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    const newClass: Classroom = { id: '', userId: teacherId, name: newClassName, studentCount: 0, students: [] };
    await saveClassroom(newClass);
    await loadClassrooms();
    setNewClassName('');
    setShowAddClass(false);
  };

  const handleEditClass = async (id: string, newName: string) => {
    const cls = classrooms.find(c => c.id === id);
    if (cls) {
      cls.name = newName;
      await saveClassroom(cls);
      await loadClassrooms();
    }
  };

  const handleDeleteClass = (id: string) => {
    const classToDelete = classrooms.find(c => c.id === id);
    if (!classToDelete) return;
    
    // 检查引用
    const checkResult = checkClassroomReferences(id);
    
    setConfirmState({
      classId: id,
      className: classToDelete.name,
      references: checkResult.references
    });
  };

  const executeDeleteClass = async () => {
    if (!confirmState) return;
    const id = confirmState.classId;

    await cascadeDeleteClassroom(id, teacherId);
    
    await loadClassrooms();
    if (selectedClassId === id) onSelectClass(null);
    setConfirmState(null);
  };

  return (
    <div className="h-full flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Left Sidebar */}
      <ClassSidebar
        classrooms={classrooms}
        selectedClassId={selectedClassId}
        onSelectClass={onSelectClass}
        onCreateClass={() => setShowAddClass(true)}
        onEditClass={handleEditClass}
        onDeleteClass={handleDeleteClass}
      />

      {/* Right Content Area */}
      {selectedClassId ? (
        <ClassDetailView 
          classId={selectedClassId} 
          teacherId={teacherId}
          onBack={() => onSelectClass(null)} 
          onOpenGradingTask={onOpenGradingTask}
          onOpenGradingExam={onOpenGradingExam}
          onRefreshClassrooms={loadClassrooms}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Users size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-bold">请选择一个班级</p>
          </div>
        </div>
      )}

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
      
      {/* Delete Confirmation Modal with References */}
      {confirmState && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">删除班级</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  班级 "{confirmState.className}"
                </p>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {confirmState.references.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        <p className="font-medium mb-1">发现关联数据</p>
                        <p>该班级有以下关联数据：</p>
                      </div>
                    </div>
                  </div>
                  
                  {confirmState.references.map((ref, idx) => (
                    <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {ref.type === 'StudentPracticeData' && '学生练习数据'}
                          {ref.type === 'Submission' && '作业提交'}
                          {ref.type === 'ExamSession' && '考试记录'}
                        </span>
                        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                          {ref.count} 个
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                      本次删除将级联软删除班级及关联学生数据，可在回收站恢复，超过30天将自动清理。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    该班级没有关联数据，可以安全删除
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
              >
                取消
              </button>
              <button
                onClick={() => executeDeleteClass()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                级联删除（软删除）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ClassDetailView = ({ 
  classId, 
  teacherId,
  onBack, 
  onOpenGradingTask,
  onOpenGradingExam,
  onRefreshClassrooms
}: { 
  classId: string, 
  teacherId: string,
  onBack: () => void,
  onOpenGradingTask: (taskId: string) => void,
  onOpenGradingExam: (examId: string, classId: string) => void,
  onRefreshClassrooms?: () => void 
}) => {
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignedResources, setAssignedResources] = useState<MediaResource[]>([]);
  const [assignedExams, setAssignedExams] = useState<ExamPaper[]>([]);
  const [examSessionsByExamId, setExamSessionsByExamId] = useState<Record<string, ExamSession[]>>({});
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newStudentData, setNewStudentData] = useState({ name: '', username: '' });
  const [editingDeadlineResource, setEditingDeadlineResource] = useState<MediaResource | null>(null);
  const [editingDeadlineExam, setEditingDeadlineExam] = useState<ExamPaper | null>(null);
  const [newDeadline, setNewDeadline] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'resources' | 'exams'>('exams');
  
  // 综合确认框状态
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean, 
    title: string, 
    message: string, 
    onConfirm: () => void,
    type?: "danger" | "info"
  } | null>(null);

  const loadData = async () => {
    const classes = await getClassrooms(teacherId);
    const cls = classes.find(c => c.id === classId);
    if (cls) setClassroom(cls);
    const [allResources, allExams] = await Promise.all([
      getResources(teacherId, false),
      getExamPapers(teacherId)
    ]);
    setAssignedResources(allResources.filter(r => r.assignedClassIds?.includes(classId)).sort((a, b) => b.createdAt - a.createdAt));
    const assigned = allExams.filter(e => e.assignedClassIds?.includes(classId));
    setAssignedExams(assigned);

    const sessionsByExamId: Record<string, ExamSession[]> = {};
    await Promise.all(
      assigned.map(async (exam) => {
        sessionsByExamId[exam.id] = await getExamSessionsByExamAndClass(exam.id, classId);
      })
    );
    setExamSessionsByExamId(sessionsByExamId);
  };

  useEffect(() => { loadData(); }, [classId, teacherId]);

  useEffect(() => {
    const handleDataChanged = () => loadData();
    window.addEventListener('parlezplus:data-changed', handleDataChanged as EventListener);
    return () => window.removeEventListener('parlezplus:data-changed', handleDataChanged as EventListener);
  }, [classId, teacherId]);

  const handleAddStudent = async () => {
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
        await saveUser(existingUser);
        
        const newStudent: Student = { 
            id: `s-${Date.now()}`, 
            userId: existingUser.id, 
            name: existingUser.name, 
            avatar: existingUser.avatar, 
            overallProgress: 0 
        };
        const updatedClass = { ...classroom!, students: [...classroom!.students, newStudent], studentCount: classroom!.students.length + 1 };
        await saveClassroom(updatedClass);
        setConfirmConfig({
          isOpen: true,
          title: "导入成功",
          message: `已找到现有账号 @${existingUser.username}，已将其加入班级。`,
          onConfirm: () => {},
          type: "info"
        });
    } else {
        const username = newStudentData.username.trim().toLowerCase();
        const name = newStudentData.name.trim();

        try {
          const created = await apiClient.post<{ id: string; username: string; role: string; name: string; existed?: boolean; alreadyInClass?: boolean; restored?: boolean }>(
            '/api/users',
            {
              username,
              password: '123456',
              role: 'student',
              name,
              classId,
              needsPasswordChange: true,
            }
          );

          // 处理后端返回的"用户已存在"情况
          if (created.existed) {
            if (created.alreadyInClass) {
              setConfirmConfig({
                isOpen: true,
                title: "提示",
                message: `学生 @${created.username} 已在班级中。`,
                onConfirm: () => {},
                type: "info"
              });
            } else {
              // 用户已存在并已被加入班级（或被恢复）
              const newStudent: Student = { id: `s-${Date.now()}`, userId: created.id, name: created.name, overallProgress: 0 };
              const updatedClass = { ...classroom!, students: [...classroom!.students, newStudent], studentCount: classroom!.students.length + 1 };
              await saveClassroom(updatedClass);
              
              setConfirmConfig({
                isOpen: true,
                title: created.restored ? "恢复成功" : "添加成功",
                message: created.restored 
                  ? `已恢复并添加学生 @${created.username} 到班级。`
                  : `已找到现有账号 @${created.username}，已将其加入班级。`,
                onConfirm: () => {},
                type: "info"
              });
            }
          } else {
            // 全新创建的用户
            const newUser: UserType = {
              id: created.id,
              username: created.username,
              password: '123456',
              name: created.name,
              role: 'student',
              isBlocked: false,
              classId: classId,
              needsPasswordChange: true,
            };
            await saveUser(newUser);

            const newStudent: Student = { id: `s-${Date.now()}`, userId: created.id, name, overallProgress: 0 };
            const updatedClass = { ...classroom!, students: [...classroom!.students, newStudent], studentCount: classroom!.students.length + 1 };
            await saveClassroom(updatedClass);
          }
        } catch (e: any) {
          setConfirmConfig({
            isOpen: true,
            title: '创建失败',
            message: e?.message || '创建学生账号失败',
            onConfirm: () => {},
            type: 'danger'
          });
          return;
        }
    }
    
    await loadData();
    setNewStudentData({ name: '', username: '' });
    setShowAddStudent(false);
  };

  const handleBatchImportStudents = async (list: { name: string; username: string }[]) => {
    const existingUsers = getUsers();
    let addedCount = 0;
    let createdCount = 0;
    let skipCount = 0;
    const resultsErrors: string[] = [];

    if (!classroom) return;

    const newStudents: Student[] = [...(classroom.students || [])];

    for (const item of list) {
      const username = item.username.trim().toLowerCase();
      const name = item.name.trim();
      if (!username || !name) continue;

      // 检查是否已经在当前班级
      if (newStudents.some(s => s.userId && getUserById(s.userId)?.username === username)) {
        skipCount++;
        continue;
      }

      const existingUser = existingUsers.find(u => u.username === username);
      if (existingUser) {
        // 账号存在，关联班级（本地）
        existingUser.classId = classId;
        await saveUser(existingUser);
        newStudents.push({
          id: `s-${Date.now()}-${username}`,
          userId: existingUser.id,
          name: existingUser.name,
          avatar: existingUser.avatar,
          overallProgress: 0
        });
        addedCount++;
        continue;
      }

      // 账号不存在，新建（写入后端，确保可登录）
      try {
        const created = await apiClient.post<{ id: string; username: string; role: string; name: string; existed?: boolean; alreadyInClass?: boolean; restored?: boolean }>(
          '/api/users',
          {
            username,
            password: '123456',
            role: 'student',
            name,
            classId,
            needsPasswordChange: true,
          }
        );

        // 处理后端返回的"用户已存在"情况
        if (created.existed) {
          if (created.alreadyInClass) {
            skipCount++;
          } else {
            // 用户已存在并已被加入班级（或被恢复）
            newStudents.push({
              id: `s-${Date.now()}-${username}`,
              userId: created.id,
              name: created.name,
              overallProgress: 0
            });
            addedCount++;
          }
        } else {
          // 全新创建的用户
          const newUser: UserType = {
            id: created.id,
            username: created.username,
            password: '123456',
            name: created.name,
            role: 'student',
            isBlocked: false,
            classId: classId,
            needsPasswordChange: true,
          };
          await saveUser(newUser);
          newStudents.push({
            id: `s-${Date.now()}-${username}`,
            userId: created.id,
            name: newUser.name,
            overallProgress: 0
          });
          createdCount++;
        }
      } catch (e: any) {
        resultsErrors.push(`@${username}: ${e?.message || '创建失败'}`);
        skipCount++;
      }
    }

    const updatedClass = { ...classroom, students: newStudents, studentCount: newStudents.length };
    await saveClassroom(updatedClass);
    await loadData();

    const errorText = resultsErrors.length > 0
      ? `\n\n失败明细：\n${resultsErrors.slice(0, 10).join('\n')}${resultsErrors.length > 10 ? '\n...更多略' : ''}`
      : '';
    setConfirmConfig({
      isOpen: true,
      title: '导入完成',
      message: `导入操作已结束。\n新增关联: ${addedCount} 人\n新开账号: ${createdCount} 人\n跳过/失败: ${skipCount} 人${errorText}`,
      onConfirm: () => {},
      type: 'info'
    });
    setShowBatchImport(false);
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
              onConfirm: async () => {
                user.password = '123456';
                await saveUser(user);
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
      onConfirm: async () => {
        const student = classroom?.students.find(s => s.id === studentId);
        if (student && student.userId) {
            const user = getUserById(student.userId);
            if (user) {
                user.classId = undefined;
                await saveUser(user);
            }
        }
        const updatedClass = { ...classroom!, students: classroom!.students.filter(s => s.id !== studentId), studentCount: classroom!.students.length - 1 };
        await saveClassroom(updatedClass);
        await loadData();
      }
    });
  };

  const handleWithdrawTask = (resourceId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "撤回任务",
      message: "确定要从该班级撤回此任务吗？学生将无法再看到该任务。",
      onConfirm: async () => {
        const resource = await getResourceById(resourceId);
        if (resource) {
          const updated = { ...resource, assignedClassIds: (resource.assignedClassIds || []).filter(id => id !== classId) };
          await saveResource(updated);
          await loadData();
        }
      }
    });
  };

  const handleWithdrawExam = (examId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "撤回试卷",
      message: "确定要从该班级撤回此试卷吗？学生将无法再看到该试卷任务。",
      onConfirm: async () => {
        const exams = await getExamPapers(teacherId);
        const exam = exams.find(e => e.id === examId);
        if (exam) {
          const nextAssigned = (exam.assignedClassIds || []).filter(id => id !== classId);
          const nextDeadlines = { ...(exam.assignedClassDeadlines || {}) };
          delete nextDeadlines[classId];
          const updated = {
            ...exam,
            assignedClassIds: nextAssigned,
            assignedClassDeadlines: Object.keys(nextDeadlines).length > 0 ? nextDeadlines : undefined
          };
          await updateExamPaper(updated);
          await loadData();
        }
      }
    });
  };

  const handleUpdateDeadline = async () => {
    if (editingDeadlineResource) {
      const updated = { ...editingDeadlineResource, deadline: newDeadline ? new Date(newDeadline).getTime() : undefined };
      await saveResource(updated);
      await loadData();
      setEditingDeadlineResource(null);
    } else if (editingDeadlineExam) {
      const nextDeadlines = { ...(editingDeadlineExam.assignedClassDeadlines || {}) };
      if (newDeadline) {
        nextDeadlines[classId] = new Date(newDeadline).getTime();
      } else {
        delete nextDeadlines[classId];
      }
      
      const updated = {
        ...editingDeadlineExam,
        assignedClassDeadlines: Object.keys(nextDeadlines).length > 0 ? nextDeadlines : undefined
      };
      
      await updateExamPaper(updated);
      await loadData();
      setEditingDeadlineExam(null);
    }
  };

  if (!classroom) return null;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
      {/* Header */}
      <div className="shrink-0 h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{classroom.name}</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-md"
          >
            <BookmarkPlus size={16} /> 分发新任务
          </button>
        </div>
      </div>

      {/* Content Area with Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('exams')}
              className={`py-3 px-2 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'exams'
                  ? 'text-purple-600 dark:text-purple-400 border-purple-600'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileCheck size={16} /> 作业任务
              </span>
            </button>
            <button
              onClick={() => setActiveTab('resources')}
              className={`py-3 px-2 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'resources'
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <History size={16} /> 跟读任务
              </span>
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`py-3 px-2 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'roster'
                  ? 'text-blue-600 dark:text-blue-400 border-blue-600'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <Users size={16} /> 学生名册
              </span>
            </button>
          </div>
        </div>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6">
          {activeTab === 'roster' ? (
             <StudentRoster
                classId={classId}
                students={classroom.students || []}
                onAddStudent={() => setShowAddStudent(true)}
                onBatchImport={() => setShowBatchImport(true)}
                onResetPassword={handleResetPassword}
                onRemoveStudent={handleRemoveStudent}
                isExpanded={true}
                onToggleExpanded={() => {}}
              />
          ) : activeTab === 'resources' ? (
            <div>
              {assignedResources.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <Send size={48} className="mb-2 opacity-10" />
                  <p className="text-sm font-bold">班级暂无分发任务</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400">任务内容</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 text-center">完成进度</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 text-center">截止日期</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {assignedResources.map(res => {
                        const submitted = MOCK_SUBMISSIONS.filter(s => s.resourceId === res.id).length;
                        const total = (classroom.students || []).length;
                        return (
                          <tr key={res.id} className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                            <td className="px-6 py-4 align-middle">
                              <div className="flex items-center gap-3 min-w-0">
                                <img src={res.coverImage} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-sm" />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{res.title}</p>
                                  <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded font-bold">{res.level}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center align-middle">
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">{submitted}/{total}</span>
                            </td>
                            <td className="px-6 py-4 text-center align-middle">
                              <button 
                                onClick={() => { 
                                  setEditingDeadlineResource(res); 
                                  setNewDeadline(res.deadline ? new Date(res.deadline).toLocaleString('sv').replace(' ', 'T').slice(0, 16) : ''); 
                                }} 
                                className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 group/date transition-colors justify-center mx-auto"
                              >
                                <Clock size={12} className={res.deadline && Date.now() > res.deadline ? "text-red-500" : ""} />
                                <span className={res.deadline && Date.now() > res.deadline ? "text-red-500 font-bold" : ""}>
                                  {res.deadline ? new Date(res.deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '无限制'}
                                </span>
                                <Edit2 size={10} className="opacity-0 group-hover/date:opacity-100 transition-opacity" />
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={() => onOpenGradingTask(res.id)} 
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white transition-all shadow-sm"
                                >
                                  <FileCheck size={14} /> 批改
                                </button>
                                <button 
                                  onClick={() => handleWithdrawTask(res.id)} 
                                  className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <MinusCircle size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              {assignedExams.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <FileCheck size={48} className="mb-2 opacity-10" />
                  <p className="text-sm font-bold">班级暂无分发的试卷</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400">作业内容</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 text-center">完成进度</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 text-center">截止日期</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {assignedExams.map(exam => {
                        const sessions = examSessionsByExamId[exam.id] || [];
                        const submitted = sessions.filter(s => s.isSubmitted).length;
                        const total = (classroom.students || []).length;
                        const deadline = exam.assignedClassDeadlines?.[classId];
                        return (
                          <tr key={exam.id} className="group hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors">
                            <td className="px-6 py-4 align-middle">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                                  <FileCheck size={20} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{exam.title}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    共 {exam.sections.reduce((acc, s) => acc + s.items.length, 0)} 题 · 
                                    总分 {exam.totalScore} 分
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center align-middle">
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">{submitted}/{total}</span>
                            </td>
                            <td className="px-6 py-4 text-center align-middle">
                              <button 
                                onClick={() => { 
                                  setEditingDeadlineExam(exam); 
                                  setNewDeadline(deadline ? new Date(deadline).toLocaleString('sv').replace(' ', 'T').slice(0, 16) : ''); 
                                }}
                                className="text-xs text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1 group/date transition-colors justify-center mx-auto"
                              >
                                <Clock size={12} className={deadline && Date.now() > deadline ? "text-red-500" : ""} />
                                <span className={deadline && Date.now() > deadline ? "text-red-500 font-bold" : ""}>
                                  {deadline ? new Date(deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '无限制'}
                                </span>
                                <Edit2 size={10} className="opacity-0 group-hover/date:opacity-100 transition-opacity" />
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center align-middle">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => onOpenGradingExam(exam.id, classId)}
                                  className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                  title="批改试卷"
                                >
                                  批改
                                </button>
                                <button 
                                  onClick={() => handleWithdrawExam(exam.id)} 
                                  className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                  title="撤回试卷"
                                >
                                  <MinusCircle size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Deadlines Update Modal */}
      {(editingDeadlineResource || editingDeadlineExam) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl w-80 animate-fade-in-up border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-2 dark:text-slate-100">修改截止日期</h3>
            <p className="text-sm text-slate-500 mb-4 truncate font-medium">
              {(editingDeadlineResource?.title || editingDeadlineExam?.title)}
            </p>
            <input type="datetime-local" className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => {
                  setEditingDeadlineResource(null);
                  setEditingDeadlineExam(null);
                }} 
                className="px-4 py-2 text-slate-500 text-sm font-bold"
              >
                取消
              </button>
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
            onImport={handleBatchImportStudents}
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
      {showAddTask && (
        <AddTaskModal
          teacherId={teacherId}
          classId={classId}
          onClose={() => setShowAddTask(false)}
          onAssignResource={async (rid, d) => {
            const resource = await getResourceById(rid);
            if (resource) {
              const nextClassIds = Array.from(new Set([...(resource.assignedClassIds || []), classId]));
              await saveResource({ ...resource, status: 'ready', deadline: d, assignedClassIds: nextClassIds });
            }
            await loadData();
            setShowAddTask(false);
          }}
          onAssignExam={async (examId, d) => {
            const exams = await getExamPapers(teacherId);
            const exam = exams.find(e => e.id === examId);
            if (exam) {
              const nextClassIds = Array.from(new Set([...(exam.assignedClassIds || []), classId]));
              const nextDeadlines = { ...(exam.assignedClassDeadlines || {}) };
              if (typeof d === 'number') {
                nextDeadlines[classId] = d;
              } else {
                delete nextDeadlines[classId];
              }
              await updateExamPaper({
                ...exam,
                assignedClassIds: nextClassIds,
                assignedClassDeadlines: Object.keys(nextDeadlines).length > 0 ? nextDeadlines : undefined
              });
            }
            await loadData();
            setShowAddTask(false);
          }}
          alreadyAssignedResourceIds={assignedResources.map(r => r.id)}
          alreadyAssignedExamIds={assignedExams.map(e => e.id)}
        />
      )}
      
      {showAddStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-black mb-6 dark:text-slate-100">添加学生</h3>
            <div className="space-y-4">
              <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 dark:text-white" placeholder="真实姓名" value={newStudentData.name} onChange={e => setNewStudentData({ ...newStudentData, name: e.target.value })} />
              <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 dark:text-white" placeholder="用户名" value={newStudentData.username} onChange={e => setNewStudentData({ ...newStudentData, username: e.target.value.replace(/\s+/g, '') })} />
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

const BatchImportModal = ({ onClose, onImport }: { onClose: () => void, onImport: (list: {name: string, username: string}[]) => void | Promise<void> }) => {
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
        void onImport(list);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-fade-in-up border border-slate-200 dark:border-slate-800">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
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
                <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500">取消</button>
                    <button onClick={handleProcess} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg hover:bg-indigo-700 transition">开始分析并导入</button>
                </div>
            </div>
        </div>
    );
};

const AddTaskModal = ({
  teacherId,
  classId,
  onClose,
  onAssignResource,
  onAssignExam,
  alreadyAssignedResourceIds,
  alreadyAssignedExamIds
}: {
  teacherId: string;
  classId: string;
  onClose: () => void;
  onAssignResource: (id: string, deadline?: number) => void;
  onAssignExam: (examId: string, deadline?: number) => void;
  alreadyAssignedResourceIds: string[];
  alreadyAssignedExamIds: string[];
}) => {
  const [resources, setResources] = useState<MediaResource[]>([]);
  const [exams, setExams] = useState<ExamPaper[]>([]);
  const [activeTab, setActiveTab] = useState<'resources' | 'exams'>('resources');
  const [selectedDeadline, setSelectedDeadline] = useState<string>('');
  const [selectedExamDeadline, setSelectedExamDeadline] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      const allResources = await getResources(teacherId, false);
      setResources(allResources.filter(r => !alreadyAssignedResourceIds.includes(r.id)));
      const allExams = await getExamPapers(teacherId);
      setExams(allExams.filter(e => !alreadyAssignedExamIds.includes(e.id)));
    };
    loadData();
  }, [teacherId, alreadyAssignedResourceIds, alreadyAssignedExamIds]);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden animate-fade-in-up border border-slate-200 dark:border-slate-800">
                <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">分发新任务</h3>
            <div className="mt-3 inline-flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 gap-1">
              <button
                onClick={() => setActiveTab('resources')}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition ${activeTab === 'resources' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                资源任务
              </button>
              <button
                onClick={() => setActiveTab('exams')}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition ${activeTab === 'exams' ? 'bg-purple-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                试卷任务
              </button>
            </div>
          </div>
                    <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition text-slate-400"><X size={20} /></button>
                </div>
        {activeTab === 'resources' && (
          <div className="p-8 bg-indigo-50/30 border-b border-indigo-100 shrink-0">
            <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">任务截止时间 (可选)</label>
            <input type="datetime-local" className="w-full bg-white border border-indigo-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white" value={selectedDeadline} onChange={e => setSelectedDeadline(e.target.value)} />
          </div>
        )}
        {activeTab === 'exams' && (
          <div className="p-8 bg-purple-50/40 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-900/20 shrink-0">
            <label className="block text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2">试卷截止时间 (可选)</label>
            <input type="datetime-local" className="w-full bg-white border border-purple-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:text-white" value={selectedExamDeadline} onChange={e => setSelectedExamDeadline(e.target.value)} />
          </div>
        )}
                <div className="p-6 overflow-y-auto no-scrollbar flex-1 space-y-4">
          {activeTab === 'resources' ? (
            resources.length === 0 ? (
              <p className="py-12 text-center text-slate-400 italic">没有可分发的资源</p>
            ) : (
              resources.map(res => (
                <div key={res.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-indigo-50 group">
                   <div className="flex items-center gap-4">
                     <img src={res.coverImage} className="w-14 h-14 rounded-xl object-cover" />
                     <p className="font-bold text-slate-800 dark:text-slate-100">{res.title}</p>
                   </div>
                   <button onClick={() => onAssignResource(res.id, selectedDeadline ? new Date(selectedDeadline).getTime() : undefined)} className="px-5 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl opacity-0 group-hover:opacity-100 shadow-md">分发</button>
                </div>
              ))
            )
          ) : (
            exams.length === 0 ? (
              <p className="py-12 text-center text-slate-400 italic">没有可分发的试卷</p>
            ) : (
              exams.map(exam => (
                <div key={exam.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-purple-50/40 dark:hover:bg-purple-900/10 group">
                   <div className="flex items-center gap-4 min-w-0">
                     <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                       <FileCheck size={22} className="text-white" />
                     </div>
                     <div className="min-w-0">
                       <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{exam.title}</p>
                       <p className="text-xs text-slate-500">
                         {exam.sections.reduce((acc, s) => acc + s.items.length, 0)} 题 · {exam.totalScore} 分
                       </p>
                     </div>
                   </div>
                   <button onClick={() => onAssignExam(exam.id, selectedExamDeadline ? new Date(selectedExamDeadline).getTime() : undefined)} className="px-5 py-2 bg-purple-600 text-white text-xs font-black rounded-xl opacity-0 group-hover:opacity-100 shadow-md">分发</button>
                </div>
              ))
            )
          )}
                </div>
            </div>
        </div>
    );
};

const TeacherSettingsModal = ({ onClose, onLogout }: { onClose: () => void, onLogout: () => void }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'api' | 'security'>('profile');
  const [azureKey, setAzureKey] = useState(user?.id ? localStorage.getItem(`${user.id}_azure_speech_key`) || '' : '');
  const [azureRegion, setAzureRegion] = useState(user?.id ? localStorage.getItem(`${user.id}_azure_speech_region`) || 'westeurope' : 'westeurope');
  const [geminiKey, setGeminiKey] = useState(user?.id ? localStorage.getItem(`${user.id}_gemini_api_key`) || '' : '');
  const [hasD1GeminiKey, setHasD1GeminiKey] = useState(false);
  const [hasD1AzureKey, setHasD1AzureKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [candidateImage, setCandidateImage] = useState<string | null>(null);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 从 D1 加载 key 状态（跨浏览器同步）
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    apiClient.get<{ hasGeminiKey: boolean; hasAzureKey: boolean; azureRegion: string }>(`/api/users/${user.id}/api-keys`).then(data => {
      if (!active) return;
      setHasD1GeminiKey(data.hasGeminiKey);
      setHasD1AzureKey(data.hasAzureKey);
      if (data.azureRegion && !localStorage.getItem(`${user.id}_azure_speech_region`)) {
        setAzureRegion(data.azureRegion);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCandidateImage(event.target?.result as string);
      setShowAvatarEditor(true);
      // Reset input value to allow selecting same file again
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedImage: string) => {
    setAvatarPreview(croppedImage);
    setShowAvatarEditor(false);
    setCandidateImage(null);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      // 保存 API Keys 到数据库（加密存储）—— 只传有值的字段
      const apiKeysPayload: Record<string, string | undefined> = {
        azureRegion: azureRegion || 'westeurope',
      };
      if (geminiKey) apiKeysPayload.geminiKey = geminiKey;
      if (azureKey) apiKeysPayload.azureKey = azureKey;
      await apiClient.put(`/api/users/${user.id}/api-keys`, apiKeysPayload);
      
      // 同时保存到 localStorage 作为缓存（用于前端快速读取）
      if (azureKey) localStorage.setItem(`${user.id}_azure_speech_key`, azureKey);
      localStorage.setItem(`${user.id}_azure_speech_region`, azureRegion);
      if (geminiKey) localStorage.setItem(`${user.id}_gemini_api_key`, geminiKey);
      
      // 保存头像
      if (avatarPreview !== user.avatar) {
        const updatedUser = { ...user, avatar: avatarPreview || undefined };
        saveUser(updatedUser);
      }
      
      setIsSaving(false);
      onClose();
      window.location.reload(); // 刷新以更新头像显示
    } catch (error) {
      console.error('Save settings error:', error);
      alert('保存失败，请检查网络连接');
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex h-[500px] border border-slate-200 dark:border-slate-800">
          <div className="w-48 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-100 dark:border-slate-800 flex flex-col p-4 shrink-0">
            <nav className="space-y-1">
              <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${activeTab === 'profile' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200/50'}`}><Camera size={18} /> 个人资料</button>
              <button onClick={() => setActiveTab('api')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${activeTab === 'api' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200/50'}`}><Settings size={18} /> API 设置</button>
              <button onClick={() => setActiveTab('security')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${activeTab === 'security' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200/50'}`}><Lock size={18} /> 安全设置</button>
            </nav>
            <button onClick={onLogout} className="mt-auto w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50"><LogOut size={18} /> 退出登录</button>
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center"><h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{activeTab === 'profile' ? '个人资料' : activeTab === 'api' ? 'API 与服务配置' : '安全与密码'}</h2><button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-400"><X size={20} /></button></div>
            <div className="p-8 flex-1 overflow-y-auto no-scrollbar">
              {activeTab === 'profile' ? (
                <div className="max-w-md mx-auto text-center">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">个人头像</h3>
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                      {avatarPreview ? (
                        <img 
                          src={avatarPreview} 
                          alt="Avatar" 
                          className="w-32 h-32 rounded-full object-cover border-4 border-slate-100 dark:border-slate-800 shadow-lg"
                        />
                      ) : (
                        <div 
                          className="w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-lg border-4 border-slate-100 dark:border-slate-800"
                          style={{ backgroundColor: getColorFromString(user?.id || user?.name || '') }}
                        >
                          {getInitials(user?.name || '')}
                        </div>
                      )}
                      {isUploadingAvatar && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <Loader2 size={32} className="text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Camera size={16} />
                        {avatarPreview ? '更换头像' : '上传头像'}
                      </button>
                      {avatarPreview && (
                        <button
                          onClick={handleRemoveAvatar}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                        >
                          <Trash2 size={16} />
                          删除
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      支持 JPG、PNG 或 WEBP 格式，最大 5MB
                    </p>
                  </div>
                </div>
              ) : activeTab === 'api' ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Azure Key {hasD1AzureKey && !azureKey && <span className="text-emerald-500 ml-1">✓ 已配置(服务端)</span>}</label><input type="password" value={azureKey} onChange={e => setAzureKey(e.target.value)} placeholder={hasD1AzureKey ? '已配置，留空则保持不变' : ''} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Azure Region</label><input type="text" value={azureRegion} onChange={e => setAzureRegion(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Gemini Key {hasD1GeminiKey && !geminiKey && <span className="text-emerald-500 ml-1">✓ 已配置(服务端)</span>}</label><input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder={hasD1GeminiKey ? '已配置，留空则保持不变' : ''} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" /></div>
                  </div>
                </div>
              ) : (
                <div className="max-w-md mx-auto">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">修改密码</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">为了您的账户安全，建议定期更新密码</p>
                  </div>
                  <ChangePasswordForm onSuccess={() => onClose()} />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0"><button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500">取消</button><button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">{isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={18} />} 保存配置</button></div>
          </div>
        </div>
      </div>
      {showAvatarEditor && candidateImage && (
        <AvatarEditor 
          image={candidateImage}
          onCrop={handleCropComplete}
          onCancel={() => {
            setShowAvatarEditor(false);
            setCandidateImage(null);
          }}
        />
      )}
    </>
  );
};

export default TeacherDashboard;
